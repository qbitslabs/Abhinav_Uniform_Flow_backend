import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import './types/auth';
import { env } from './config/env';
import { ensureDb } from './config/db';
import { authenticate } from './middlewares/authMiddleware';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';
import measurementRoutes from './routes/measurementRoutes';
import manufacturingRoutes from './routes/manufacturingRoutes';
import productionTaskRoutes from './routes/productionTaskRoutes';
import workerRoutes from './routes/workerRoutes';
import sectorRoutes from './routes/sectorRoutes';
import uniformItemRoutes from './routes/uniformItemRoutes';
import auditLogRoutes from './routes/auditLogRoutes';
import settingsRoutes from './routes/settingsRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import userRoutes from './routes/userRoutes';
import ledgerRoutes from './routes/ledgerRoutes';
import trackRoutes from './routes/trackRoutes';

const app = express();

// Public static client tracking portal
const candidateTrackPaths = [
  path.resolve(process.cwd(), '../TRACK'),
  path.resolve(__dirname, '../../TRACK'),
  path.resolve(__dirname, '../../../TRACK'),
];
const trackDir = candidateTrackPaths.find((p) => fs.existsSync(p)) || candidateTrackPaths[0];
app.use('/track', express.static(trackDir));

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin.length ? env.corsOrigin : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Ensure Mongo is connected (required on Vercel serverless cold starts)
app.use(async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    next(err);
  }
});
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/track', cors(), trackRoutes); // Public tracking with universal CORS for client subdomain

app.use('/api/orders', authenticate, orderRoutes);
app.use('/api/measurements', authenticate, measurementRoutes);
app.use('/api/manufacturing', authenticate, manufacturingRoutes);
app.use('/api/production-tasks', authenticate, productionTaskRoutes);
app.use('/api/workers', authenticate, workerRoutes);
app.use('/api/ledger', authenticate, ledgerRoutes);
app.use('/api/sectors', authenticate, sectorRoutes);
app.use('/api/uniform-items', authenticate, uniformItemRoutes);
app.use('/api/audit-logs', authenticate, auditLogRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/users', authenticate, userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
