import { Schema, model, Document } from 'mongoose';
import { TAILORING_STATUSES, URGENCY_LEVELS, TailoringStatus } from '../constants/stages';

export interface MeasurementDoc extends Document {
  customId: string;
  ticketNumber: string;
  orderId: string;
  orderName?: string;
  personName: string;
  personCode?: string;
  garmentItemId: string;
  garmentItemName: string;
  size: string;
  measurements: Map<string, number>;
  notes?: string;
  workerName?: string;
  workerNames: string[];
  status: TailoringStatus;
  dueDate?: Date;
  urgency: string;
  createdAt: Date;
  updatedAt: Date;
}

const measurementSchema = new Schema<MeasurementDoc>(
  {
    customId: { type: String, required: true, unique: true },
    ticketNumber: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    orderName: { type: String },
    personName: { type: String, required: true, trim: true },
    personCode: { type: String },
    garmentItemId: { type: String, required: true, index: true },
    garmentItemName: { type: String, required: true },
    size: { type: String, default: 'Custom' },
    measurements: { type: Map, of: Number, default: {} },
    notes: { type: String },
    workerName: { type: String },
    workerNames: [{ type: String }],
    status: { type: String, enum: TAILORING_STATUSES, default: 'Open', index: true },
    dueDate: { type: Date },
    urgency: { type: String, enum: URGENCY_LEVELS, default: 'Normal' },
  },
  { timestamps: true, collection: 'measurements' }
);

measurementSchema.index({ personName: 'text', ticketNumber: 'text', personCode: 'text' });

export const Measurement = model<MeasurementDoc>('Measurement', measurementSchema);
