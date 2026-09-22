import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let connecting: Promise<void> | null = null;

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8000,
  });
  logger.info('MongoDB connected');
}

/** Safe for serverless: reuse the connection across warm invocations. */
export async function ensureDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    connecting = connectDb().finally(() => {
      connecting = null;
    });
  }
  await connecting;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
