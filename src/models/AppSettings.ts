import { Schema, model, Document } from 'mongoose';

export interface AppSettingsDoc extends Document {
  isSingleton: boolean;
  supervisorPin: string;
  adminPassword: string;
  floorPin: string;
  requireAuthForDelete: boolean;
  requireAuthForEdit: boolean;
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  gstNumber: string;
  printFooterNote: string;
  updatedAt: Date;
}

const appSettingsSchema = new Schema<AppSettingsDoc>(
  {
    isSingleton: { type: Boolean, default: true, unique: true },
    supervisorPin: { type: String, required: true, select: false },
    adminPassword: { type: String, required: true, select: false },
    floorPin: { type: String, required: true, select: false },
    requireAuthForDelete: { type: Boolean, default: true },
    requireAuthForEdit: { type: Boolean, default: true },
    companyName: { type: String, default: 'Abhinav Uniforms Production Unit' },
    companyPhone: { type: String },
    companyAddress: { type: String },
    gstNumber: { type: String },
    printFooterNote: { type: String },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: 'app_settings' }
);

export const AppSettings = model<AppSettingsDoc>('AppSettings', appSettingsSchema);
