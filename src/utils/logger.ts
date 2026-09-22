import winston from 'winston';
import { env } from '../config/env';

export const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `${timestamp} [${level}] ${message}\n${stack}`
        : `${timestamp} [${level}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
