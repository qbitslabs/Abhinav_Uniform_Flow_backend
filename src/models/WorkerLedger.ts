import { Schema, model, Document } from 'mongoose';

export const LEDGER_TRANSACTION_TYPES = [
  'Advance Payment',
  'Piece-Rate Earning',
  'Wage Payout',
  'Bonus',
  'Deduction',
  'Monthly Salary',
] as const;
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];

export const LEDGER_ENTRY_TYPES = ['Credit', 'Debit'] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'N/A', 'Other'] as const;
export type LedgerPaymentMode = (typeof LEDGER_PAYMENT_MODES)[number];

export interface WorkerLedgerDoc extends Document {
  customId: string;
  voucherNumber: string;
  workerId: string;
  workerName: string;
  workerPhone?: string;
  transactionType: LedgerTransactionType;
  entryType: LedgerEntryType; // 'Credit' = Worker Earned (Factory Payable +), 'Debit' = Paid to Worker (Factory Payable -)
  amount: number;
  pieces?: number;
  ratePerPiece?: number;
  garmentItemName?: string;
  orderNumber?: string;
  paymentMode: LedgerPaymentMode;
  referenceNumber?: string;
  date: Date;
  notes?: string;
  recordedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const workerLedgerSchema = new Schema<WorkerLedgerDoc>(
  {
    customId: { type: String, required: true, unique: true },
    voucherNumber: { type: String, required: true, unique: true },
    workerId: { type: String, required: true, index: true },
    workerName: { type: String, required: true },
    workerPhone: { type: String },
    transactionType: {
      type: String,
      enum: LEDGER_TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: LEDGER_ENTRY_TYPES,
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    pieces: { type: Number },
    ratePerPiece: { type: Number },
    garmentItemName: { type: String },
    orderNumber: { type: String },
    paymentMode: {
      type: String,
      enum: LEDGER_PAYMENT_MODES,
      default: 'Cash',
    },
    referenceNumber: { type: String },
    date: { type: Date, default: Date.now, index: true },
    notes: { type: String },
    recordedBy: { type: String },
  },
  { timestamps: true, collection: 'worker_ledgers' }
);

workerLedgerSchema.index({ workerId: 1, date: -1 });
workerLedgerSchema.index({ workerName: 'text', voucherNumber: 'text', referenceNumber: 'text', notes: 'text' });

export const WorkerLedger = model<WorkerLedgerDoc>('WorkerLedger', workerLedgerSchema);
