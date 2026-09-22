import { env } from './env';

export const defaultAppSettings = {
  isSingleton: true,
  supervisorPin: env.supervisorPinDefault,
  adminPassword: env.adminPasswordDefault,
  floorPin: env.floorPinDefault,
  requireAuthForDelete: true,
  requireAuthForEdit: true,
  companyName: 'Abhinav Uniforms Production Unit',
  companyPhone: '+91 98765 43210',
  companyAddress: 'Plot 42, Okhla Industrial Area Phase-III, New Delhi - 110020',
  gstNumber: '07AAAAA0000A1Z5',
  printFooterNote: 'ABHINAV UNIFORMS ERP • Official Manufacturing & Tailoring Record',
};
