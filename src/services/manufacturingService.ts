import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { ManufacturingTicket, ManufacturingTicketDoc } from '../models/ManufacturingTicket';
import { Order } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { serializeDoc } from '../utils/serialize';
import { searchRegex, cleanText } from '../utils/helpers';
import { nextMfgTicketNumber } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicIdOrThrow } from './lookup';
import { PRODUCTION_STAGES, isProductionStage, stageIndex } from '../constants/stages';
import { requirePin } from '../utils/pin';

export async function syncOrderStageFromTickets(orderId: string) {
  const tickets = await ManufacturingTicket.find({ orderId });
  if (!tickets.length) return;
  const minIdx = Math.min(...tickets.map((t) => stageIndex(t.productionStage)).filter((i) => i >= 0));
  if (minIdx < 0) return;
  const minStage = PRODUCTION_STAGES[minIdx];
  const order = await Order.findOne({ customId: orderId });
  if (order && order.productionStage !== minStage) {
    const from = order.productionStage;
    order.productionStage = minStage;
    order.stageHistory.push({
      timestamp: new Date(),
      fromStage: from,
      toStage: minStage,
      reason: 'Synced from manufacturing tickets',
      actorName: 'System',
      actorId: 'SYSTEM',
      isRevert: stageIndex(minStage) < stageIndex(from),
    });
    await order.save();
  }
}

export async function listTickets(query: Record<string, unknown>) {
  const filter: FilterQuery<ManufacturingTicketDoc> = {};
  if (query.orderId) filter.orderId = String(query.orderId);
  if (query.stage) filter.productionStage = String(query.stage);
  if (query.activeTab === 'dispatched') filter.productionStage = 'Dispatched';
  if (query.activeTab === 'active') filter.productionStage = { $ne: 'Dispatched' };
  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [{ ticketNumber: rx }, { orderName: rx }, { itemName: rx }, { orderNumber: rx }];
  }
  const rows = await ManufacturingTicket.find(filter).sort({ generatedOn: -1 });
  return rows.map((r) => serializeDoc(r));
}

export async function getTicket(id: string) {
  const ticket = await findByPublicIdOrThrow(ManufacturingTicket, id, 'Manufacturing ticket', ['ticketNumber']);
  return serializeDoc(ticket);
}

export async function createTicket(body: Record<string, unknown>, req: Request) {
  const order = await findByPublicIdOrThrow(Order, String(body.orderId), 'Order', ['orderNumber']);
  const ids = await nextMfgTicketNumber();
  const ticket = await ManufacturingTicket.create({
    customId: ids.customId,
    ticketNumber: ids.ticketNumber,
    orderId: order.customId,
    orderName: order.name,
    orderNumber: order.orderNumber,
    sectorName: order.sectorName,
    itemId: body.itemId,
    itemName: body.itemName,
    size: body.size,
    quantity: body.quantity,
    productionStage: order.productionStage,
    specialRequirement: order.specialRequirement,
    notes: cleanText(body.notes as string),
    generatedOn: new Date(),
  });

  await writeAudit({
    req,
    actionType: 'MFG_TICKET_GENERATED',
    entityType: 'Manufacturing',
    entityId: ticket.ticketNumber,
    description: `Generated manufacturing ticket ${ticket.ticketNumber} for ${ticket.itemName} (${ticket.quantity} pcs)`,
    details: { ticketNumber: ticket.ticketNumber, quantity: ticket.quantity, item: ticket.itemName },
    severity: 'SUCCESS',
  });

  return serializeDoc(ticket);
}

export async function updateTicketStage(id: string, body: Record<string, unknown>, req: Request) {
  const ticket = await findByPublicIdOrThrow(ManufacturingTicket, id, 'Manufacturing ticket', ['ticketNumber']);
  const from = ticket.productionStage;
  const fromIdx = stageIndex(from);
  let toIdx = fromIdx;

  if (body.newStage) {
    if (!isProductionStage(String(body.newStage))) throw ApiError.badRequest('Invalid stage');
    toIdx = stageIndex(String(body.newStage));
  } else if (body.delta !== undefined) {
    const delta = Number(body.delta);
    if (delta !== 1 && delta !== -1) {
      throw ApiError.badRequest('delta must be +1 or -1');
    }
    toIdx = fromIdx + delta;
  }

  if (toIdx < 0 || toIdx >= PRODUCTION_STAGES.length) {
    throw ApiError.badRequest('Stage is already at the beginning or end of the pipeline');
  }

  const newStage = PRODUCTION_STAGES[toIdx];
  const isRevert = toIdx < fromIdx;

  if (isRevert) {
    await requirePin((body.pin || body.supervisorPin) as string | undefined, 'supervisor', req);
  } else if (body.delta === undefined && toIdx !== fromIdx + 1 && toIdx !== fromIdx) {
    throw ApiError.badRequest('Forward ticket stage changes must be sequential unless using delta');
  }

  if (from === newStage) return serializeDoc(ticket);

  ticket.productionStage = newStage;
  await ticket.save();
  await syncOrderStageFromTickets(ticket.orderId);

  await writeAudit({
    req,
    actionType: isRevert ? 'STAGE_REVERTED' : 'STAGE_UPDATED',
    entityType: 'Manufacturing',
    entityId: ticket.ticketNumber,
    description: `Ticket ${ticket.ticketNumber} moved from "${from}" to "${newStage}"`,
    details: { previousStage: from, newStage, isRevert },
    severity: isRevert ? 'WARNING' : 'SUCCESS',
  });

  return serializeDoc(ticket);
}
