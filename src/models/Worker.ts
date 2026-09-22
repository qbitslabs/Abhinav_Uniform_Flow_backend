import { Schema, model, Document } from 'mongoose';
import { FLOOR_STAGES, FloorStage, WORKER_PAY_TYPES, WorkerPayType } from '../constants/stages';

export type { WorkerPayType };
export { WORKER_PAY_TYPES };

export interface WorkerActivityRate {
  activity: FloorStage;
  ratePerPiece?: number;
}

export interface WorkerDoc extends Document {
  customId: string;
  name: string;
  phone: string;
  payType: WorkerPayType;
  /** Monthly salary amount when payType is Salaried */
  monthlySalary?: number;
  /**
   * Salary cycle start (joining / “starts from”).
   * First auto Monthly Salary credit posts on the same day next month, then every month.
   */
  salaryStartDate?: Date;
  /**
   * For Salaried: activities they perform (no rates required).
   * For Per Piece: activities with ratePerPiece for auto ledger.
   */
  activities: WorkerActivityRate[];
  /**
   * Floor Admin User.customId when this worker is that admin's pay/ledger account.
   * Detail page displays this userId (USR-…) instead of the worker WRK id.
   */
  userId?: string;
  /** @deprecated legacy alias — migrated to userId */
  linkedUserId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workerActivitySchema = new Schema<WorkerActivityRate>(
  {
    activity: { type: String, enum: FLOOR_STAGES, required: true },
    ratePerPiece: { type: Number, min: 0 },
  },
  { _id: false }
);

const workerSchema = new Schema<WorkerDoc>(
  {
    customId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    payType: { type: String, enum: WORKER_PAY_TYPES, default: 'Per Piece', index: true },
    monthlySalary: { type: Number, min: 0 },
    salaryStartDate: { type: Date },
    activities: { type: [workerActivitySchema], default: [] },
    userId: { type: String, index: true, sparse: true },
    linkedUserId: { type: String, index: true, sparse: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'workers' }
);

workerSchema.index({ name: 1 });
workerSchema.index({ isActive: 1 });
workerSchema.index({ 'activities.activity': 1 });

export const Worker = model<WorkerDoc>('Worker', workerSchema);
