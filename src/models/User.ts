import { Schema, model, Document } from 'mongoose';
import { USER_ROLES, UserRole } from '../constants/stages';

export interface UserDoc extends Document {
  customId: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  password: string;
  role: UserRole;
  /** Monthly salary for Floor Admin accounts (set on create/edit). */
  monthlySalary?: number;
  /**
   * Salary cycle start (“starts from” / joining).
   * First auto credit = same calendar day next month.
   */
  salaryStartDate?: Date;
  /** Worker.customId of the side-by-side pay/ledger account created with this Floor Admin. */
  workerId?: string;
  /** @deprecated legacy alias — migrated to workerId */
  linkedWorkerId?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    customId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'Floor Admin' },
    monthlySalary: { type: Number, min: 0 },
    salaryStartDate: { type: Date },
    workerId: { type: String, index: true, sparse: true },
    linkedWorkerId: { type: String, index: true, sparse: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true, collection: 'users' }
);

export const User = model<UserDoc>('User', userSchema);
