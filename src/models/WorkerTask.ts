import { Schema, model, Document } from 'mongoose';
import { FLOOR_STAGES, SHIFTS, TASK_STATUSES, TaskStatus } from '../constants/stages';

export interface WorkerTaskDoc extends Document {
  customId: string;
  taskNumber: string;
  workerId: string;
  workerName: string;
  workerPhone?: string;
  orderId: string;
  orderName: string;
  orderNumber: string;
  itemId?: string;
  itemName: string;
  size?: string;
  stage: string;
  assignedPieces: number;
  completedPieces: number;
  assignedDate: Date;
  targetDate?: Date;
  shift: string;
  status: TaskStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const workerTaskSchema = new Schema<WorkerTaskDoc>(
  {
    customId: { type: String, required: true, unique: true },
    taskNumber: { type: String, required: true, unique: true },
    workerId: { type: String, required: true, index: true },
    workerName: { type: String, required: true },
    workerPhone: { type: String },
    orderId: { type: String, required: true, index: true },
    orderName: { type: String, required: true },
    orderNumber: { type: String, required: true },
    itemId: { type: String },
    itemName: { type: String, required: true },
    size: { type: String },
    stage: { type: String, enum: FLOOR_STAGES, required: true, index: true },
    assignedPieces: { type: Number, required: true, min: 1 },
    completedPieces: { type: Number, default: 0, min: 0 },
    assignedDate: { type: Date, default: Date.now },
    targetDate: { type: Date },
    shift: { type: String, enum: SHIFTS, default: 'General Shift' },
    status: { type: String, enum: TASK_STATUSES, default: 'Assigned', index: true },
    notes: { type: String },
  },
  { timestamps: true, collection: 'worker_tasks' }
);

workerTaskSchema.index({ workerName: 'text', orderName: 'text', itemName: 'text', taskNumber: 'text' });

export const WorkerTask = model<WorkerTaskDoc>('WorkerTask', workerTaskSchema);
