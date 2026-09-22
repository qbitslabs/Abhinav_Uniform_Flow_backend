import bcrypt from 'bcryptjs';
import { AppSettings, AppSettingsDoc } from '../models/AppSettings';
import { SecurityPin, SecurityPinType } from '../models/SecurityPin';
import { defaultAppSettings } from '../config/defaultSettings';
import { env } from '../config/env';
import { ApiError } from './ApiError';

const SALT_ROUNDS = 10;

const PIN_DEFAULTS: Record<SecurityPinType, string> = {
  supervisor: env.supervisorPinDefault,
  floor: env.floorPinDefault,
  admin: env.adminPasswordDefault,
};

export async function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, SALT_ROUNDS);
}

export async function compareSecret(plain: string, hashed: string): Promise<boolean> {
  if (!plain || !hashed) return false;
  if (hashed.startsWith('$2a$') || hashed.startsWith('$2b$') || hashed.startsWith('$2y$')) {
    return bcrypt.compare(plain, hashed);
  }
  return plain === hashed;
}

export async function getSettingsDoc(): Promise<AppSettingsDoc> {
  let settings = await AppSettings.findOne({ isSingleton: true }).select('+supervisorPin +adminPassword +floorPin');
  if (!settings) {
    settings = await AppSettings.create({
      ...defaultAppSettings,
      supervisorPin: await hashSecret(defaultAppSettings.supervisorPin),
      adminPassword: await hashSecret(defaultAppSettings.adminPassword),
      floorPin: await hashSecret(defaultAppSettings.floorPin),
    });
  }
  return settings;
}

export async function getPinHash(pinType: SecurityPinType): Promise<string | null> {
  const row = await SecurityPin.findOne({ pinType }).select('+hash');
  return row?.hash || null;
}

export async function setPinHash(pinType: SecurityPinType, plain: string): Promise<void> {
  const hash = await hashSecret(plain);
  await SecurityPin.findOneAndUpdate({ pinType }, { hash }, { upsert: true, new: true });
}

export async function pinIsSet(pinType: SecurityPinType): Promise<boolean> {
  return Boolean(await getPinHash(pinType));
}

export async function ensureSecurityPins(): Promise<void> {
  const settings = await AppSettings.findOne({ isSingleton: true }).select('+supervisorPin +adminPassword +floorPin');
  const fallback: Record<SecurityPinType, string | undefined> = {
    supervisor: settings?.supervisorPin,
    floor: settings?.floorPin,
    admin: settings?.adminPassword,
  };

  for (const pinType of ['supervisor', 'floor', 'admin'] as SecurityPinType[]) {
    const existing = await SecurityPin.findOne({ pinType }).select('+hash');
    if (existing?.hash) continue;

    const migrated = fallback[pinType];
    if (migrated) {
      await SecurityPin.findOneAndUpdate({ pinType }, { hash: migrated }, { upsert: true });
      continue;
    }

    await SecurityPin.create({
      pinType,
      hash: await hashSecret(PIN_DEFAULTS[pinType]),
    });
  }
}

export type PinType = SecurityPinType;

export async function verifyPin(pin: string, type: PinType = 'supervisor'): Promise<boolean> {
  await ensureSecurityPins();
  const hashes: string[] = [];
  const supervisor = await getPinHash('supervisor');
  const admin = await getPinHash('admin');
  const floor = await getPinHash('floor');

  if (type === 'supervisor') {
    if (supervisor) hashes.push(supervisor);
    if (admin) hashes.push(admin);
  } else if (type === 'floor') {
    if (floor) hashes.push(floor);
    if (supervisor) hashes.push(supervisor);
    if (admin) hashes.push(admin);
  } else if (admin) {
    hashes.push(admin);
  }

  for (const hashed of hashes) {
    if (await compareSecret(pin, hashed)) return true;
  }
  return false;
}

export async function verifyMasterPin(pin: string): Promise<boolean> {
  await ensureSecurityPins();
  const hash = await getPinHash('supervisor');
  if (!hash || !pin.trim()) return false;
  return compareSecret(pin.trim(), hash);
}

export async function requirePin(
  pin: string | undefined,
  type: PinType = 'supervisor',
  req?: { user?: { role?: string } }
): Promise<void> {
  if (req?.user?.role === 'Super Admin') return;
  if (!pin || !pin.trim()) {
    throw ApiError.forbidden('Supervisor PIN or Floor Admin password is required');
  }
  const ok = await verifyPin(pin.trim(), type);
  if (!ok) {
    throw ApiError.forbidden('Invalid PIN or password. Authorization failed.');
  }
}

export async function maybeRequirePin(
  pin: string | undefined,
  requiredFlag: boolean,
  req?: { user?: { role?: string } },
  type: PinType = 'supervisor'
): Promise<void> {
  if (!requiredFlag) return;
  await requirePin(pin, type, req);
}
