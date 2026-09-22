import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { Measurement, MeasurementDoc } from '../models/Measurement';
import { Order } from '../models/Order';
import { serializeDoc, mapToObject } from '../utils/serialize';
import { parsePagination, searchRegex, cleanText } from '../utils/helpers';
import { nextMeasurementNumber } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicId, findByPublicIdOrThrow } from './lookup';
import { getSettingsDoc, maybeRequirePin } from '../utils/pin';

function serializeMeasurement(doc: MeasurementDoc) {
  const obj = serializeDoc<Record<string, unknown>>(doc);
  obj.measurements = mapToObject(doc.measurements);
  return obj;
}

export async function listMeasurements(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: FilterQuery<MeasurementDoc> = {};
  if (query.orderId) filter.orderId = String(query.orderId);
  if (query.garmentItemId) filter.garmentItemId = String(query.garmentItemId);
  if (query.status) filter.status = String(query.status);
  if (query.tab === 'delivered') filter.status = 'Delivered';
  if (query.tab === 'active') filter.status = { $ne: 'Delivered' };
  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [{ personName: rx }, { ticketNumber: rx }, { personCode: rx }, { garmentItemName: rx }];
  }

  const [rows, total] = await Promise.all([
    Measurement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Measurement.countDocuments(filter),
  ]);

  return { data: rows.map(serializeMeasurement), meta: { total, page, limit } };
}

export async function getMeasurement(id: string) {
  const doc = await findByPublicIdOrThrow(Measurement, id, 'Measurement', ['ticketNumber']);
  return serializeMeasurement(doc);
}

export async function createMeasurement(body: Record<string, unknown>, req: Request) {
  const orderIdInput = body.orderId ? String(body.orderId) : 'OPEN-WORK';
  const order = await findByPublicId(Order, orderIdInput, ['orderNumber']);
  const ids = await nextMeasurementNumber();
  const workerNames = (body.workerNames as string[]) || (body.workerName ? [String(body.workerName)] : []);

  const doc = await Measurement.create({
    customId: ids.customId,
    ticketNumber: ids.ticketNumber,
    orderId: order?.customId || orderIdInput,
    orderName: (body.orderName as string) || order?.name,
    personName: String(body.personName).trim(),
    personCode: body.personCode,
    garmentItemId: body.garmentItemId,
    garmentItemName: body.garmentItemName,
    size: (body.size as string) || 'Custom',
    measurements: body.measurements || {},
    notes: cleanText(body.notes as string),
    workerName: workerNames[0],
    workerNames,
    status: 'Open',
    dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
    urgency: body.urgency || 'Normal',
  });

  await writeAudit({
    req,
    actionType: 'MEASUREMENT_RECORDED',
    entityType: 'Measurement',
    entityId: doc.ticketNumber,
    description: `Generated measurement ticket ${doc.ticketNumber} for ${doc.personName} (${doc.garmentItemName})`,
    details: { orderId: doc.orderId, personName: doc.personName, size: doc.size },
    severity: 'SUCCESS',
  });

  return serializeMeasurement(doc);
}

export async function updateMeasurement(id: string, body: Record<string, unknown>, req: Request) {
  const doc = await findByPublicIdOrThrow(Measurement, id, 'Measurement', ['ticketNumber']);
  const settings = await getSettingsDoc();
  await maybeRequirePin(
    (body.supervisorPin || body.pin) as string | undefined,
    settings.requireAuthForEdit,
    req
  );

  const fields = [
    'personName',
    'personCode',
    'garmentItemId',
    'garmentItemName',
    'size',
    'status',
    'urgency',
  ] as const;
  for (const f of fields) {
    if (body[f] !== undefined) (doc as unknown as Record<string, unknown>)[f] = body[f];
  }
  if (body.measurements) doc.measurements = body.measurements as Map<string, number>;
  if (body.notes !== undefined) doc.notes = cleanText(body.notes as string);
  if (body.dueDate !== undefined) doc.dueDate = body.dueDate ? new Date(String(body.dueDate)) : undefined;
  if (body.workerNames) {
    doc.workerNames = body.workerNames as string[];
    doc.workerName = doc.workerNames[0];
  } else if (body.workerName !== undefined) {
    doc.workerName = String(body.workerName);
    doc.workerNames = doc.workerName ? [doc.workerName] : [];
  }
  await doc.save();

  await writeAudit({
    req,
    actionType: 'MEASUREMENT_UPDATED',
    entityType: 'Measurement',
    entityId: doc.ticketNumber,
    description: `Updated measurement parchi ${doc.ticketNumber} (${doc.personName} · ${doc.garmentItemName})`,
    details: { personName: doc.personName, size: doc.size, status: doc.status },
    severity: 'INFO',
  });

  return serializeMeasurement(doc);
}

export async function batchAssign(measurementIds: string[], workerNames: string[], req: Request) {
  const names = workerNames.map((n) => n.trim()).filter(Boolean);
  const updated = [];
  for (const id of measurementIds) {
    const doc = await findByPublicId(Measurement, id, ['ticketNumber']);
    if (!doc) continue;
    doc.workerNames = names;
    doc.workerName = names[0];
    if (doc.status === 'Open') doc.status = 'In Tailoring';
    await doc.save();
    updated.push(serializeMeasurement(doc));
  }

  await writeAudit({
    req,
    actionType: 'TASK_ASSIGNED',
    entityType: 'Measurement',
    entityId: measurementIds.join(','),
    description: `Batch-assigned ${updated.length} measurement slip(s) to ${names.join(', ')}`,
    severity: 'INFO',
  });

  return updated;
}

export async function updateMeasurementStatus(id: string, status: string, req: Request) {
  const doc = await findByPublicIdOrThrow(Measurement, id, 'Measurement', ['ticketNumber']);
  const previous = doc.status;
  doc.status = status as MeasurementDoc['status'];
  await doc.save();
  await writeAudit({
    req,
    actionType: 'MEASUREMENT_UPDATED',
    entityType: 'Measurement',
    entityId: doc.ticketNumber,
    description: `Measurement parchi ${doc.ticketNumber} status ${previous} → ${doc.status}`,
    details: { previousStatus: previous, status: doc.status },
    severity: 'INFO',
  });
  return serializeMeasurement(doc);
}

export async function deleteMeasurement(id: string, pin: string | undefined, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(pin, settings.requireAuthForDelete, req);
  const doc = await findByPublicIdOrThrow(Measurement, id, 'Measurement', ['ticketNumber']);
  await doc.deleteOne();
  await writeAudit({
    req,
    actionType: 'MEASUREMENT_DELETED',
    entityType: 'Measurement',
    entityId: doc.ticketNumber,
    description: `Deleted measurement parchi ${doc.ticketNumber} (${doc.personName} · ${doc.garmentItemName})`,
    details: { personName: doc.personName, orderId: doc.orderId },
    severity: 'CRITICAL',
  });
}
