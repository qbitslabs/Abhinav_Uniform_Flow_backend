import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { Sector, SectorClient, SectorClientDoc } from '../models/Sector';
import { serializeDoc } from '../utils/serialize';
import { searchRegex, cleanText } from '../utils/helpers';
import { nextSectorId, nextClientId } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicIdOrThrow } from './lookup';
import { ApiError } from '../utils/ApiError';

export async function listSectors() {
  const rows = await Sector.find().sort({ customId: 1 });
  return rows.map((r) => serializeDoc(r));
}

export async function createSector(body: { name: string; description?: string; isActive?: boolean }, req: Request) {
  const existing = await Sector.findOne({ name: body.name.trim() });
  if (existing) throw ApiError.conflict('A sector with this name already exists');
  const customId = await nextSectorId();
  const sector = await Sector.create({
    customId,
    name: body.name.trim(),
    description: body.description,
    isActive: body.isActive !== false,
  });
  await writeAudit({
    req,
    actionType: 'SECTOR_MODIFIED',
    entityType: 'MasterData',
    entityId: sector.customId,
    description: `Created sector "${sector.name}"`,
    details: { sectorId: sector.customId, sectorName: sector.name },
    severity: 'SUCCESS',
  });
  return serializeDoc(sector);
}

export async function updateSector(id: string, body: Record<string, unknown>, req: Request) {
  const sector = await findByPublicIdOrThrow(Sector, id, 'Sector');
  if (body.name) sector.name = String(body.name).trim();
  if (body.description !== undefined) sector.description = String(body.description);
  if (body.isActive !== undefined) sector.isActive = Boolean(body.isActive);
  await sector.save();
  await writeAudit({
    req,
    actionType: 'SECTOR_MODIFIED',
    entityType: 'MasterData',
    entityId: sector.customId,
    description: `Updated sector "${sector.name}"`,
    severity: 'INFO',
  });
  return serializeDoc(sector);
}

export async function deleteSector(id: string, req: Request) {
  const sector = await findByPublicIdOrThrow(Sector, id, 'Sector');
  await SectorClient.deleteMany({ $or: [{ sectorName: sector.name }, { sectorId: sector._id }] });
  await sector.deleteOne();
  await writeAudit({
    req,
    actionType: 'SECTOR_MODIFIED',
    entityType: 'MasterData',
    entityId: sector.customId,
    description: `Deleted sector "${sector.name}"`,
    severity: 'CRITICAL',
  });
}

export async function listClients(query: Record<string, unknown>) {
  const filter: FilterQuery<SectorClientDoc> = {};
  if (query.sectorName) filter.sectorName = String(query.sectorName);
  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [{ name: rx }, { contactPerson: rx }, { contactNumber: rx }];
  }
  const rows = await SectorClient.find(filter).sort({ customId: 1 });
  return rows.map((r) => serializeDoc(r));
}

export async function createClient(body: Record<string, unknown>, req: Request) {
  const sector = await Sector.findOne({ name: String(body.sectorName) });
  const customId = await nextClientId(String(body.sectorName));
  const client = await SectorClient.create({
    customId,
    name: String(body.name).trim(),
    sectorName: body.sectorName,
    sectorId: sector?._id,
    contactPerson: body.contactPerson,
    contactNumber: body.contactNumber,
    deliveryAddress: body.deliveryAddress,
    specialRequirement: body.specialRequirement,
    designUrl: cleanText(body.designUrl as string),
    defaultGarmentItemIds: (body.defaultGarmentItemIds as string[]) || [],
  });
  await writeAudit({
    req,
    actionType: 'SECTOR_MODIFIED',
    entityType: 'MasterData',
    entityId: client.customId,
    description: `Added client "${client.name}" under ${client.sectorName}`,
    severity: 'SUCCESS',
  });
  return serializeDoc(client);
}

export async function updateClient(id: string, body: Record<string, unknown>, req: Request) {
  const client = await findByPublicIdOrThrow(SectorClient, id, 'Client');
  const fields = ['name', 'sectorName', 'contactPerson', 'contactNumber', 'deliveryAddress', 'specialRequirement'] as const;
  for (const f of fields) {
    if (body[f] !== undefined) (client as unknown as Record<string, unknown>)[f] = body[f];
  }
  if (body.designUrl !== undefined) {
    client.designUrl = cleanText(String(body.designUrl || '')) || undefined;
  }
  if (body.defaultGarmentItemIds) client.defaultGarmentItemIds = body.defaultGarmentItemIds as string[];
  if (body.sectorName) {
    const sector = await Sector.findOne({ name: String(body.sectorName) });
    client.sectorId = sector?._id;
  }
  await client.save();
  await writeAudit({
    req,
    actionType: 'SECTOR_MODIFIED',
    entityType: 'MasterData',
    entityId: client.customId,
    description: `Updated client "${client.name}"`,
    severity: 'INFO',
  });
  return serializeDoc(client);
}

export async function deleteClient(id: string, req: Request) {
  const client = await findByPublicIdOrThrow(SectorClient, id, 'Client');
  await client.deleteOne();
  await writeAudit({
    req,
    actionType: 'SECTOR_MODIFIED',
    entityType: 'MasterData',
    entityId: client.customId,
    description: `Removed client "${client.name}"`,
    severity: 'WARNING',
  });
}
