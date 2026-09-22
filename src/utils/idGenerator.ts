import { Counter } from '../models/Counter';
import { SECTOR_CLIENT_PREFIX } from './helpers';

export async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

export async function setSeq(key: string, value: number): Promise<void> {
  await Counter.findOneAndUpdate({ key }, { $max: { seq: value } }, { upsert: true });
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export async function nextOrderNumber(year = new Date().getFullYear()): Promise<{ customId: string; orderNumber: string }> {
  const seq = await nextSeq(`order-${year}`);
  return {
    customId: `ORD-${pad(seq, 3)}`,
    orderNumber: `ORD-${year}-${pad(seq, 3)}`,
  };
}

export async function nextMfgTicketNumber(): Promise<{ customId: string; ticketNumber: string }> {
  const seq = await nextSeq('mfg');
  return { customId: `MFG-${pad(seq, 3)}`, ticketNumber: `MFG-${pad(seq, 6)}` };
}

export async function nextMeasurementNumber(): Promise<{ customId: string; ticketNumber: string }> {
  const seq = await nextSeq('measurement');
  return { customId: `MES-${pad(seq, 3)}`, ticketNumber: `MT-${pad(seq, 6)}` };
}

export async function nextTaskNumber(): Promise<{ customId: string; taskNumber: string }> {
  const seq = await nextSeq('task');
  return { customId: `TSK-${pad(seq, 3)}`, taskNumber: `TSK-${pad(seq, 5)}` };
}

export async function nextWorkerId(): Promise<string> {
  const seq = await nextSeq('worker');
  return `WRK-${pad(seq, 3)}`;
}

export async function nextSectorId(): Promise<string> {
  const seq = await nextSeq('sector');
  return `SEC-${pad(seq, 2)}`;
}

export async function nextClientId(sectorName: string): Promise<string> {
  const prefix = SECTOR_CLIENT_PREFIX[sectorName] || sectorName.slice(0, 3).toUpperCase();
  const seq = await nextSeq(`client-${prefix}`);
  return `CLI-${prefix}-${pad(seq, 2)}`;
}

export async function nextItemId(): Promise<string> {
  const seq = await nextSeq('item');
  return `ITEM-${pad(seq, 3)}`;
}

export async function nextUserId(): Promise<string> {
  const seq = await nextSeq('user');
  return `USR-${pad(seq, 3)}`;
}

export async function nextAuditId(): Promise<string> {
  const seq = await nextSeq('audit');
  return `LOG-${pad(seq, 3)}`;
}

export async function nextLedgerVoucherNumber(year = new Date().getFullYear()): Promise<{ customId: string; voucherNumber: string }> {
  const seq = await nextSeq(`ledger-${year}`);
  return {
    customId: `LED-${pad(seq, 4)}`,
    voucherNumber: `VCH-${year}-${pad(seq, 4)}`,
  };
}
