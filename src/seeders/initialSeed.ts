import { seedAndExit } from './runSeed';
import { logger } from '../utils/logger';

seedAndExit()
  .then(() => {
    logger.info('Seed script finished.');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Seed failed', err);
    process.exit(1);
  });
