import { Schema, model, Document } from 'mongoose';

export const SECURITY_PIN_TYPES = ['supervisor', 'floor', 'admin'] as const;
export type SecurityPinType = (typeof SECURITY_PIN_TYPES)[number];

export interface SecurityPinDoc extends Document {
  pinType: SecurityPinType;
  hash: string;
  updatedAt: Date;
  createdAt: Date;
}

const securityPinSchema = new Schema<SecurityPinDoc>(
  {
    pinType: { type: String, enum: SECURITY_PIN_TYPES, required: true, unique: true, index: true },
    hash: { type: String, required: true, select: false },
  },
  { timestamps: true, collection: 'security_pins' }
);

export const SecurityPin = model<SecurityPinDoc>('SecurityPin', securityPinSchema);
