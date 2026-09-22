import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { Order, OrderDoc, OrderItem } from '../models/Order';
import { ManufacturingTicket } from '../models/ManufacturingTicket';
import { WorkerTask } from '../models/WorkerTask';
import { Measurement } from '../models/Measurement';
import { ApiError } from '../utils/ApiError';
import { serializeDoc } from '../utils/serialize';
import { parsePagination, searchRegex, cleanText } from '../utils/helpers';
import { nextOrderNumber, nextMfgTicketNumber } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicIdOrThrow } from './lookup';
import { PRODUCTION_STAGES, FLOOR_STAGES, isProductionStage, stageIndex } from '../constants/stages';
import { getSettingsDoc, maybeRequirePin, requirePin } from '../utils/pin';

function totals(items: { quantity: number; rate: number }[]) {
  const mapped: OrderItem[] = items.map((it, idx) => ({
    id: (it as OrderItem).id || `OI-${Date.now()}-${idx}`,
    uniformItemId: (it as OrderItem).uniformItemId,
    uniformItemName: (it as OrderItem).uniformItemName,
    size: (it as OrderItem).size,
    quantity: it.quantity,
    rate: it.rate,
    totalAmount: it.quantity * it.rate,
  }));
  return {
    items: mapped,
    totalPieces: mapped.reduce((s, i) => s + i.quantity, 0),
    totalAmount: mapped.reduce((s, i) => s + i.totalAmount, 0),
  };
}

export async function listOrders(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: FilterQuery<OrderDoc> = {};
  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [{ name: rx }, { orderNumber: rx }, { contactPerson: rx }, { customId: rx }];
  }
  if (query.sector && query.sector !== 'all') {
    filter.$and = filter.$and || [];
    (filter.$and as object[]).push({
      $or: [{ sectorName: query.sector }, { sectorId: query.sector }],
    });
  }
  if (query.stage && query.stage !== 'all') filter.productionStage = String(query.stage);

  const sortKey = String(query.sort || '-createdAt');
  const sort: Record<string, 1 | -1> = {};
  if (sortKey.startsWith('-')) sort[sortKey.slice(1)] = -1;
  else sort[sortKey] = 1;

  const [rows, total] = await Promise.all([
    Order.find(filter).sort(sort).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return { data: rows.map((r) => serializeDoc(r)), meta: { total, page, limit } };
}

export async function getOrder(id: string) {
  const order = await findByPublicIdOrThrow(Order, id, 'Order', ['orderNumber']);
  return serializeDoc(order);
}

export async function createOrder(body: Record<string, unknown>, req: Request) {
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    throw ApiError.badRequest('At least one order item is required');
  }

  for (const item of body.items as { uniformItemId: string; rate?: number }[]) {
    if (item.rate === undefined || item.rate === null || Number.isNaN(Number(item.rate))) {
      item.rate = 0;
    }
  }

  const { items, totalPieces, totalAmount } = totals(body.items as OrderItem[]);
  const ids = await nextOrderNumber();
  const actor = req.user!;

  const order = await Order.create({
    customId: ids.customId,
    orderNumber: ids.orderNumber,
    name: String(body.name).trim(),
    sectorId: body.sectorId,
    sectorName: body.sectorName,
    contactPerson: body.contactPerson,
    contactNumber: body.contactNumber,
    deliveryAddress: body.deliveryAddress,
    specialRequirement: cleanText(body.specialRequirement as string),
    items,
    totalPieces,
    totalAmount,
    productionStage: 'Order Received',
    deliveryDueDate: body.deliveryDueDate ? new Date(String(body.deliveryDueDate)) : undefined,
    stageHistory: [
      {
        timestamp: new Date(),
        fromStage: 'Order Received',
        toStage: 'Order Received',
        reason: 'Order created',
        actorName: actor.name,
        actorId: actor.id,
        isRevert: false,
      },
    ],
  });

  for (const item of items) {
    const mfgIds = await nextMfgTicketNumber();
    await ManufacturingTicket.create({
      customId: mfgIds.customId,
      ticketNumber: mfgIds.ticketNumber,
      orderId: order.customId,
      orderName: order.name,
      orderNumber: order.orderNumber,
      sectorName: order.sectorName,
      itemId: item.uniformItemId,
      itemName: item.uniformItemName,
      size: item.size,
      quantity: item.quantity,
      productionStage: 'Order Received',
      specialRequirement: order.specialRequirement,
      generatedOn: new Date(),
    });
  }

  await writeAudit({
    req,
    actionType: 'ORDER_CREATED',
    entityType: 'Order',
    entityId: order.customId,
    description: `Created institutional order ${order.orderNumber} (${order.name}, ${totalPieces} pcs)`,
    details: { orderNumber: order.orderNumber, totalPieces, sector: order.sectorName },
    severity: 'SUCCESS',
  });

  await writeAudit({
    req,
    actionType: 'MFG_TICKET_GENERATED',
    entityType: 'Manufacturing',
    entityId: order.customId,
    description: `Auto-generated ${items.length} manufacturing ticket(s) for ${order.orderNumber}`,
    severity: 'INFO',
  });

  return serializeDoc(order);
}

export async function updateOrder(id: string, body: Record<string, unknown>, req: Request) {
  const order = await findByPublicIdOrThrow(Order, id, 'Order', ['orderNumber']);
  const settings = await getSettingsDoc();
  await maybeRequirePin(
    (body.supervisorPin || body.pin) as string | undefined,
    settings.requireAuthForEdit,
    req
  );

  if (body.name) order.name = String(body.name);
  if (body.contactPerson) order.contactPerson = String(body.contactPerson);
  if (body.contactNumber) order.contactNumber = String(body.contactNumber);
  if (body.deliveryAddress) order.deliveryAddress = String(body.deliveryAddress);
  if (body.specialRequirement !== undefined) order.specialRequirement = cleanText(body.specialRequirement as string);
  if (body.deliveryDueDate !== undefined) {
    order.deliveryDueDate = body.deliveryDueDate ? new Date(String(body.deliveryDueDate)) : undefined;
  }
  if (body.items && Array.isArray(body.items)) {
    const t = totals(body.items as OrderItem[]);
    order.items = t.items;
    order.totalPieces = t.totalPieces;
    order.totalAmount = t.totalAmount;
  }
  await order.save();

  await writeAudit({
    req,
    actionType: 'ORDER_UPDATED',
    entityType: 'Order',
    entityId: order.customId,
    description: `Updated order ${order.orderNumber}`,
    severity: 'INFO',
  });

  return serializeDoc(order);
}

export async function updateOrderStage(id: string, body: Record<string, unknown>, req: Request) {
  const order = await findByPublicIdOrThrow(Order, id, 'Order', ['orderNumber']);
  const newStage = String(body.newStage);
  if (!isProductionStage(newStage)) {
    throw ApiError.badRequest(`Invalid production stage: ${newStage}`);
  }

  const from = order.productionStage;
  const fromIdx = stageIndex(from);
  const toIdx = stageIndex(newStage);
  const isRevert = Boolean(body.isRevert) || toIdx < fromIdx;

  if (isRevert) {
    if (!body.reason || !String(body.reason).trim()) {
      throw ApiError.badRequest('A reason is required when reverting a production stage');
    }
    await requirePin((body.pin || body.supervisorPin) as string | undefined, 'supervisor', req);
  } else if (toIdx !== fromIdx + 1 && toIdx !== fromIdx) {
    throw ApiError.badRequest(
      `Forward stage transitions must be sequential. Next valid stage after "${from}" is "${PRODUCTION_STAGES[fromIdx + 1] || 'none'}"`
    );
  } else if (toIdx > fromIdx && (FLOOR_STAGES as readonly string[]).includes(from)) {
    // Enforce: Level cannot be advanced until previous stage floor work is done
    const tasks = await WorkerTask.find({
      $or: [{ orderId: order.customId }, { orderId: order._id.toString() }, { orderNumber: order.orderNumber }],
      stage: from,
    });

    if (tasks.length === 0) {
      throw ApiError.badRequest(
        `Cannot advance to "${newStage}": No floor worker tasks have been allotted or completed for the "${from}" stage. Work must be completed before moving to the next level.`
      );
    }

    const pendingTasks = tasks.filter(
      (t) => t.status !== 'Completed' && t.completedPieces < t.assignedPieces
    );
    if (pendingTasks.length > 0) {
      const pt = pendingTasks[0];
      throw ApiError.badRequest(
        `Cannot advance to "${newStage}": Previous work for "${from}" is not done yet. Task ${pt.taskNumber} (${pt.workerName}) is still ${pt.status} (${pt.completedPieces}/${pt.assignedPieces} pcs completed). All tasks for "${from}" must be 100% completed first.`
      );
    }

    const totalCompleted = tasks.reduce((sum, t) => sum + (t.completedPieces || 0), 0);
    if (order.totalPieces > 0 && totalCompleted < order.totalPieces) {
      throw ApiError.badRequest(
        `Cannot advance to "${newStage}": Previous work for "${from}" is not done yet. Only ${totalCompleted} of ${order.totalPieces} pieces are completed. All pieces must be completed before moving to the next level.`
      );
    }

    for (const item of order.items) {
      const itemCompleted = tasks
        .filter((t) => t.itemId === item.uniformItemId && (!item.size || !t.size || t.size === item.size))
        .reduce((sum, t) => sum + (t.completedPieces || 0), 0);
      if (itemCompleted < item.quantity) {
        throw ApiError.badRequest(
          `Cannot advance to "${newStage}": Previous work for "${from}" is not done yet. "${item.uniformItemName}" has only ${itemCompleted} of ${item.quantity} pieces completed.`
        );
      }
    }
  }

  if (from === newStage) return serializeDoc(order);

  order.productionStage = newStage;
  order.stageHistory.push({
    timestamp: new Date(),
    fromStage: from,
    toStage: newStage,
    reason: cleanText(body.reason as string),
    actorName: (body.actorName as string) || req.user?.name,
    actorId: req.user?.id,
    isRevert,
  });
  await order.save();

  await ManufacturingTicket.updateMany(
    { orderId: order.customId },
    { $set: { productionStage: newStage } }
  );

  await writeAudit({
    req,
    actionType: isRevert ? 'STAGE_REVERTED' : 'STAGE_UPDATED',
    entityType: 'Order',
    entityId: order.customId,
    description: `Order ${order.orderNumber} stage ${isRevert ? 'reverted' : 'advanced'} from "${from}" to "${newStage}"`,
    details: { previousStage: from, newStage, isRevert, reason: body.reason },
    severity: isRevert ? 'WARNING' : 'SUCCESS',
  });

  return serializeDoc(order);
}

export async function deleteOrder(id: string, pin: string | undefined, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(pin, settings.requireAuthForDelete, req);

  const order = await findByPublicIdOrThrow(Order, id, 'Order', ['orderNumber']);
  const oid = order.customId;

  await Promise.all([
    ManufacturingTicket.deleteMany({ orderId: oid }),
    WorkerTask.deleteMany({ orderId: oid }),
    Measurement.deleteMany({ orderId: oid }),
    order.deleteOne(),
  ]);

  await writeAudit({
    req,
    actionType: 'ORDER_UPDATED',
    entityType: 'Order',
    entityId: oid,
    description: `CRITICAL: Deleted order ${order.orderNumber} and cascaded tickets/tasks/measurements`,
    details: { orderNumber: order.orderNumber },
    severity: 'CRITICAL',
  });
}
