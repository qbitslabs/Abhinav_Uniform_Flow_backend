import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/abhinav_uniforms_erp'),
  jwtSecret: required('JWT_SECRET', 'dev_jwt_secret_change_me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  supervisorPinDefault: process.env.SUPERVISOR_PIN_DEFAULT || '1234',
  adminPasswordDefault: process.env.ADMIN_PASSWORD_DEFAULT || 'super123',
  floorPinDefault: process.env.FLOOR_PIN_DEFAULT || '9999',
};
