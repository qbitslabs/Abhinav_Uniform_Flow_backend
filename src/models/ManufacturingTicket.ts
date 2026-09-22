import { Schema, model, Document } from 'mongoose';
import { PRODUCTION_STAGES, ProductionStage } from '../constants/stages';

export interface ManufacturingTicketDoc extends Document {
  customId: string;
  ticketNumber: string;
  orderId: string;
  orderName: string;
  orderNumber: string;
  sectorName?: string;
  itemId?: string;
  itemName: string;
  size?: string;
  quantity: number;
  productionStage: ProductionStage;
  specialRequirement?: string;
  generatedOn: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const manufacturingTicketSchema = new Schema<ManufacturingTicketDoc>(
  {
    customId: { type: String, required: true, unique: true },
    ticketNumber: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    orderName: { type: String, required: true },
    orderNumber: { type: String, required: true },
    sectorName: { type: String },
    itemId: { type: String },
    itemName: { type: String, required: true },
    size: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    productionStage: { type: String, enum: PRODUCTION_STAGES, default: 'Order Received', index: true },
    specialRequirement: { type: String },
    generatedOn: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { timestamps: true, collection: 'manufacturing_tickets' }
);

manufacturingTicketSchema.index({ orderName: 'text', itemName: 'text', ticketNumber: 'text' });

export const ManufacturingTicket = model<ManufacturingTicketDoc>(
  'ManufacturingTicket',
  manufacturingTicketSchema
);
