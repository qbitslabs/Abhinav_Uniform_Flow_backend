import { Request } from 'express';
import { UniformItem } from '../models/UniformItem';
import { serializeDoc } from '../utils/serialize';
import { nextItemId } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicIdOrThrow } from './lookup';
import { defaultHindiName } from '../utils/helpers';
import { getSettingsDoc, maybeRequirePin } from '../utils/pin';

function serializeItem(doc: any) {
  const out = serializeDoc<Record<string, unknown>>(doc);
  // Older DB docs may still carry a removed stitching/piece rate field
  delete out.rate;
  return out;
}

function normalizeFields(fields?: Array<Record<string, unknown>>) {
  return (fields || []).map((f, i) => ({
    id: String(f.id || `f${i + 1}`),
    name: String(f.name),
    hindiName: (f.hindiName as string) || defaultHindiName(String(f.name)),
    unit: (f.unit as string) || 'in',
    defaultValue: f.defaultValue as number | undefined,
  }));
}

export async function listItems() {
  const rows = await UniformItem.find().sort({ customId: 1 });
  return rows.map(serializeItem);
}

export async function createItem(body: Record<string, unknown>, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(
    (body.supervisorPin || body.pin) as string | undefined,
    settings.requireAuthForEdit,
    req
  );
  const customId = await nextItemId();
  const item = await UniformItem.create({
    customId,
    name: String(body.name).trim(),
    measurementFields: normalizeFields(body.measurementFields as Array<Record<string, unknown>>),
    isActive: body.isActive !== false,
  });
  await writeAudit({
    req,
    actionType: 'GARMENT_MODIFIED',
    entityType: 'MasterData',
    entityId: item.customId,
    description: `Created garment "${item.name}"`,
    details: {
      itemId: item.customId,
      name: item.name,
    },
    severity: 'SUCCESS',
  });
  return serializeItem(item);
}

export async function updateItem(id: string, body: Record<string, unknown>, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(
    (body.supervisorPin || body.pin) as string | undefined,
    settings.requireAuthForEdit,
    req
  );
  const item = await findByPublicIdOrThrow(UniformItem, id, 'Uniform item');

  if (body.name) item.name = String(body.name).trim();
  if (body.measurementFields) item.measurementFields = normalizeFields(body.measurementFields as Array<Record<string, unknown>>);
  if (body.isActive !== undefined) item.isActive = Boolean(body.isActive);
  if ((item as { rate?: number }).rate !== undefined) {
    item.set('rate', undefined);
  }
  await item.save();

  await writeAudit({
    req,
    actionType: 'GARMENT_MODIFIED',
    entityType: 'MasterData',
    entityId: item.customId,
    description: `Updated garment "${item.name}"`,
    details: {
      itemId: item.customId,
      name: item.name,
    },
    severity: 'INFO',
  });
  return serializeItem(item);
}

export async function deleteItem(id: string, pin: string | undefined, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(pin, settings.requireAuthForDelete, req);
  const item = await findByPublicIdOrThrow(UniformItem, id, 'Uniform item');
  await item.deleteOne();
  await writeAudit({
    req,
    actionType: 'GARMENT_MODIFIED',
    entityType: 'MasterData',
    entityId: item.customId,
    description: `Deleted garment "${item.name}"`,
    severity: 'CRITICAL',
  });
}
