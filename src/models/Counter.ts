import { Schema, model, Document } from 'mongoose';

export interface CounterDoc extends Document {
  key: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters' }
);

export const Counter = model<CounterDoc>('Counter', counterSchema);
