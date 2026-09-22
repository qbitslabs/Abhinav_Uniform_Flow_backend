import { env } from './config/env';
import { connectDb } from './config/db';
import { logger } from './utils/logger';
import app from './app';
import { startMonthlySalaryJob } from './jobs/monthlySalaryJob';

async function start() {
  await connectDb();
  app.listen(env.port, () => {
    logger.info(`Abhinav Uniforms ERP API listening on port ${env.port} (${env.nodeEnv})`);
    startMonthlySalaryJob();
  });
}

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
