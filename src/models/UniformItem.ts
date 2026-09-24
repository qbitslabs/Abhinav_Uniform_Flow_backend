import { Schema, model, Document } from 'mongoose';

export interface MeasurementField {
  id: string;
  name: string;
  hindiName?: string;
  unit: string;
  defaultValue?: number;
}

export interface UniformItemDoc extends Document {
  customId: string;
  name: string;
  measurementFields: MeasurementField[];
  hasWaist?: boolean;
  waistStartSize?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const measurementFieldSchema = new Schema<MeasurementField>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    hindiName: { type: String },
    unit: { type: String, default: 'in' },
    defaultValue: { type: Number },
  },
  { _id: false }
);

const uniformItemSchema = new Schema<UniformItemDoc>(
  {
    customId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    measurementFields: { type: [measurementFieldSchema], default: [] },
    hasWaist: { type: Boolean, default: false },
    waistStartSize: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'uniform_items' }
);

uniformItemSchema.index({ name: 1 });
uniformItemSchema.index({ isActive: 1 });

export const UniformItem = model<UniformItemDoc>('UniformItem', uniformItemSchema);
