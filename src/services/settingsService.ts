import { Request } from 'express';
import bcrypt from 'bcryptjs';
import { getSettingsDoc, pinIsSet, setPinHash, verifyMasterPin } from '../utils/pin';
import { serializeDoc } from '../utils/serialize';
import { writeAudit } from '../utils/audit';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { Sector, SectorClient } from '../models/Sector';
import { UniformItem } from '../models/UniformItem';
import { Measurement } from '../models/Measurement';
import { ManufacturingTicket } from '../models/ManufacturingTicket';
import { Worker } from '../models/Worker';
import { WorkerTask } from '../models/WorkerTask';
import { WorkerLedger } from '../models/WorkerLedger';
import { AuditLog } from '../models/AuditLog';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

/** Collections wiped by Clear Operational Data. */
const CLEARED_COLLECTIONS = [
  'orders',
  'measurements',
  'manufacturing_tickets',
  'worker_tasks',
  'worker_ledgers',
  'token_blacklist',
  'audit_logs',
] as const;

const PASSCODE_PIN = /^\d{4,6}$/;

export async function getSettings() {
  const s = await getSettingsDoc();
  const [supervisorPinSet, adminPasswordSet, floorPinSet] = await Promise.all([
    pinIsSet('supervisor'),
    pinIsSet('admin'),
    pinIsSet('floor'),
  ]);
  return {
    id: String(s._id),
    requireAuthForDelete: s.requireAuthForDelete,
    requireAuthForEdit: s.requireAuthForEdit,
    companyName: s.companyName,
    companyPhone: s.companyPhone,
    companyAddress: s.companyAddress,
    gstNumber: s.gstNumber,
    printFooterNote: s.printFooterNote,
    supervisorPinSet,
    adminPasswordSet,
    floorPinSet,
    updatedAt: s.updatedAt,
  };
}

export async function updateSettings(body: Record<string, unknown>, req?: Request) {
  const s = await getSettingsDoc();
  const changedPins: string[] = [];

  if (body.supervisorPin) {
    const pin = String(body.supervisorPin).trim();
    if (!PASSCODE_PIN.test(pin)) {
      throw ApiError.badRequest('Supervisor PIN must be a 4–6 digit passcode');
    }
    await setPinHash('supervisor', pin);
    changedPins.push('Supervisor PIN');
  }
  if (body.adminPassword) {
    const nextPassword = String(body.adminPassword).trim();
    if (nextPassword.length < 4) {
      throw ApiError.badRequest('Super Admin password must be at least 4 characters');
    }

    const currentPassword = String(body.currentPassword || '').trim();
    const masterPin = String(body.masterPin || '').trim();
    if (!currentPassword || !masterPin) {
      throw ApiError.forbidden('Current Super Admin password and master PIN are required to change the Super Admin password');
    }
    if (!req?.user?.id) {
      throw ApiError.unauthorized('Authentication required');
    }

    const actor = await User.findOne({ customId: req.user.id }).select('+password');
    if (!actor || actor.role !== 'Super Admin') {
      throw ApiError.forbidden('Only Super Admin can change this password');
    }
    const passwordOk = await bcrypt.compare(currentPassword, actor.password);
    if (!passwordOk) {
      throw ApiError.forbidden('Current Super Admin password is incorrect');
    }
    const pinOk = await verifyMasterPin(masterPin);
    if (!pinOk) {
      throw ApiError.forbidden('Master PIN is incorrect');
    }

    await setPinHash('admin', nextPassword);
    actor.password = await bcrypt.hash(nextPassword, 10);
    await actor.save();
    changedPins.push('Super Admin password');
  }
  if (body.floorPin) {
    const pin = String(body.floorPin).trim();
    if (!PASSCODE_PIN.test(pin)) {
      throw ApiError.badRequest('Floor PIN must be a 4–6 digit passcode');
    }
    await setPinHash('floor', pin);
    changedPins.push('Floor PIN');
  }

  if (body.requireAuthForDelete !== undefined) s.requireAuthForDelete = Boolean(body.requireAuthForDelete);
  if (body.requireAuthForEdit !== undefined) s.requireAuthForEdit = Boolean(body.requireAuthForEdit);
  if (body.companyName !== undefined) s.companyName = String(body.companyName);
  if (body.companyPhone !== undefined) s.companyPhone = String(body.companyPhone);
  if (body.companyAddress !== undefined) s.companyAddress = String(body.companyAddress);
  if (body.gstNumber !== undefined) s.gstNumber = String(body.gstNumber);
  if (body.printFooterNote !== undefined) s.printFooterNote = String(body.printFooterNote);
  await s.save();

  if (changedPins.length) {
    await writeAudit({
      req,
      actionType: 'PIN_CHANGED',
      entityType: 'Security',
      entityId: 'security_pins',
      description: `Authorization credentials updated: ${changedPins.join(', ')}`,
      details: { fields: changedPins },
      severity: 'CRITICAL',
    });
  }

  return getSettings();
}

/**
 * Clear operational ERP data for a fresh factory start.
 * Keeps: users, workers, sectors, sector_clients, uniform_items,
 * counters, app_settings, security_pins.
 * Then writes one new audit log recording the wipe + typed confirmation.
 */
export async function resetDemo(
  req?: Request,
  body: { confirmationPhrase?: string; backupAction?: string } = {}
) {
  const confirmationPhrase = String(body.confirmationPhrase || '').trim();
  if (confirmationPhrase.toUpperCase() !== 'REMOVE DATA') {
    throw ApiError.badRequest('Type REMOVE DATA exactly to confirm clearing operational data');
  }

  const backupRaw = String(body.backupAction || 'skipped').toLowerCase();
  const backupAction =
    backupRaw === 'json' || backupRaw === 'excel' || backupRaw === 'skipped' ? backupRaw : 'skipped';

  await Promise.all([
    Order.deleteMany({}),
    Measurement.deleteMany({}),
    ManufacturingTicket.deleteMany({}),
    WorkerTask.deleteMany({}),
    WorkerLedger.deleteMany({}),
    TokenBlacklist.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  logger.info(`Operational data cleared: ${CLEARED_COLLECTIONS.join(', ')}`);

  await writeAudit({
    req,
    actionType: 'DATA_CLEARED',
    entityType: 'Security',
    entityId: 'database_reset',
    description:
      `Operational data deleted. Fresh start applied — orders, measurements, production tickets, floor tasks, worker ledger, sessions, and prior audit logs were removed. Users, workers, sectors, clients, garments, counters, app settings, and security PINs were kept. Confirmation typed: "${confirmationPhrase}". Backup before clear: ${backupAction}.`,
    details: {
      confirmationPhrase,
      backupBeforeClear: backupAction,
      cleared: [...CLEARED_COLLECTIONS],
      kept: [
        'users',
        'workers',
        'sectors',
        'sector_clients',
        'uniform_items',
        'counters',
        'app_settings',
        'security_pins',
      ],
    },
    severity: 'CRITICAL',
  });

  return { reset: true, cleared: [...CLEARED_COLLECTIONS], backupAction, confirmationPhrase };
}

export async function exportBackup() {
  const [
    orders,
    sectors,
    sectorClients,
    uniformItems,
    measurements,
    manufacturingTickets,
    workers,
    workerTasks,
    auditLogs,
    settings,
  ] = await Promise.all([
    Order.find(),
    Sector.find(),
    SectorClient.find(),
    UniformItem.find(),
    Measurement.find(),
    ManufacturingTicket.find(),
    Worker.find(),
    WorkerTask.find(),
    AuditLog.find().sort({ timestamp: -1 }).limit(500),
    getSettings(),
  ]);

  return {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    orders: orders.map((d) => serializeDoc(d)),
    sectors: sectors.map((d) => serializeDoc(d)),
    sectorClients: sectorClients.map((d) => serializeDoc(d)),
    uniformItems: uniformItems.map((d) => serializeDoc(d)),
    measurements: measurements.map((d) => serializeDoc(d)),
    manufacturingTickets: manufacturingTickets.map((d) => serializeDoc(d)),
    workers: workers.map((d) => serializeDoc(d)),
    workerTasks: workerTasks.map((d) => serializeDoc(d)),
    auditLogs: auditLogs.map((d) => serializeDoc(d)),
    securitySettings: settings,
  };
}
