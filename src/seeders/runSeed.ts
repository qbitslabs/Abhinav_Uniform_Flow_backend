import { connectDb, disconnectDb } from '../config/db';
import { AppSettings } from '../models/AppSettings';
import { defaultAppSettings } from '../config/defaultSettings';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ensureSecurityPins, hashSecret, setPinHash } from '../utils/pin';
import { seedMockData } from './mockDataSeed';

/** Plain PIN / password values seeded with bcrypt (from .env defaults). */
const SECURITY_SECRETS = {
  supervisorPin: env.supervisorPinDefault,
  adminPassword: env.adminPasswordDefault,
  floorPin: env.floorPinDefault,
} as const;

/**
 * Create / refresh App Settings + Security PIN collection.
 * All secrets stored with bcrypt.
 */
export async function seedSecurityPins() {
  const supervisorHash = await hashSecret(SECURITY_SECRETS.supervisorPin);
  const adminHash = await hashSecret(SECURITY_SECRETS.adminPassword);
  const floorHash = await hashSecret(SECURITY_SECRETS.floorPin);

  const existing = await AppSettings.findOne({ isSingleton: true }).select(
    '+supervisorPin +adminPassword +floorPin'
  );

  if (existing) {
    existing.supervisorPin = supervisorHash;
    existing.adminPassword = adminHash;
    existing.floorPin = floorHash;
    await existing.save();
    logger.info('Updated AppSettings supervisor / admin / floor secrets (bcrypt)');
  } else {
    await AppSettings.create({
      ...defaultAppSettings,
      supervisorPin: supervisorHash,
      adminPassword: adminHash,
      floorPin: floorHash,
    });
    logger.info('Created AppSettings with supervisor / admin / floor secrets (bcrypt)');
  }

  await setPinHash('supervisor', SECURITY_SECRETS.supervisorPin);
  await setPinHash('admin', SECURITY_SECRETS.adminPassword);
  await setPinHash('floor', SECURITY_SECRETS.floorPin);
  await ensureSecurityPins();

  logger.info('Security PINs ready (values from env defaults; not logged)');
}

export async function seedAndExit() {
  await connectDb();
  await seedSecurityPins();
  await seedMockData();
  logger.info('Seed finished (security PINs + mock ERP data).');
  await disconnectDb();
}
