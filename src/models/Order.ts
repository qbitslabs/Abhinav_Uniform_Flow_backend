import { Schema, model, Document } from 'mongoose';
import { PRODUCTION_STAGES, ProductionStage } from '../constants/stages';

export interface OrderItem {
  id: string;
  uniformItemId: string;
  uniformItemName: string;
  size?: string;
  quantity: number;
  rate: number;
  totalAmount: number;
}

export interface StageHistoryEntry {
  timestamp: Date;
  fromStage: string;
  toStage: string;
  reason?: string;
  actorName?: string;
  actorId?: string;
  isRevert: boolean;
}

export interface OrderDoc extends Document {
  customId: string;
  orderNumber: string;
  name: string;
  sectorId: string;
  sectorName: string;
  contactPerson: string;
  contactNumber: string;
  deliveryAddress: string;
  specialRequirement?: string;
  items: OrderItem[];
  totalPieces: number;
  totalAmount: number;
  productionStage: ProductionStage;
  deliveryDueDate?: Date;
  stageHistory: StageHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<OrderItem>(
  {
    id: { type: String, required: true },
    uniformItemId: { type: String, required: true },
    uniformItemName: { type: String, required: true },
    size: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const stageHistorySchema = new Schema<StageHistoryEntry>(
  {
    timestamp: { type: Date, default: Date.now },
    fromStage: { type: String, required: true },
    toStage: { type: String, required: true },
    reason: { type: String },
    actorName: { type: String },
    actorId: { type: String },
    isRevert: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderSchema = new Schema<OrderDoc>(
  {
    customId: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    sectorId: { type: String, required: true, index: true },
    sectorName: { type: String, required: true, index: true },
    contactPerson: { type: String, required: true },
    contactNumber: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    specialRequirement: { type: String },
    items: { type: [orderItemSchema], default: [] },
    totalPieces: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    productionStage: { type: String, enum: PRODUCTION_STAGES, default: 'Order Received', index: true },
    deliveryDueDate: { type: Date },
    stageHistory: { type: [stageHistorySchema], default: [] },
  },
  { timestamps: true, collection: 'orders' }
);

orderSchema.index({ name: 'text', orderNumber: 'text', contactPerson: 'text' });
orderSchema.index({ createdAt: -1 });

export const Order = model<OrderDoc>('Order', orderSchema);
