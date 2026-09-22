import { Schema, model, Document, Types } from 'mongoose';

export interface SectorDoc extends Document {
  customId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sectorSchema = new Schema<SectorDoc>(
  {
    customId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'sectors' }
);

sectorSchema.index({ isActive: 1 });

export const Sector = model<SectorDoc>('Sector', sectorSchema);

export interface SectorClientDoc extends Document {
  customId: string;
  name: string;
  sectorName: string;
  sectorId?: Types.ObjectId;
  contactPerson: string;
  contactNumber: string;
  deliveryAddress: string;
  specialRequirement?: string;
  /** Drive / cloud link where uniform design images for this client are stored */
  designUrl?: string;
  defaultGarmentItemIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const sectorClientSchema = new Schema<SectorClientDoc>(
  {
    customId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    sectorName: { type: String, required: true, index: true },
    sectorId: { type: Schema.Types.ObjectId, ref: 'Sector' },
    contactPerson: { type: String, required: true },
    contactNumber: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    specialRequirement: { type: String },
    designUrl: { type: String, trim: true },
    defaultGarmentItemIds: [{ type: String }],
  },
  { timestamps: true, collection: 'sector_clients' }
);

sectorClientSchema.index({ name: 'text', contactPerson: 'text' });

export const SectorClient = model<SectorClientDoc>('SectorClient', sectorClientSchema);
