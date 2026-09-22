import mongoose from 'mongoose';

/** Strip tags / basic entities for free-text fields (notes, requirements). */
export function cleanText(value?: string | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  return cleaned.length ? cleaned : undefined;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value.trim()), 'i');
}

export function parsePagination(query: { page?: unknown; limit?: unknown }) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function isObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

export const HINDI_MEASUREMENT_LABELS: Record<string, string> = {
  chest: 'सीना',
  pet: 'पेट',
  lambai: 'लंबाई',
  baju: 'बाजू',
  tira: 'तिरा',
  kamar: 'कमर',
  hip: 'हिप',
  pat: 'पट',
  mohri: 'मोहरी',
  collar: 'कॉलर',
  ghera: 'घेरा',
  armhole: 'मुड्ढा',
  width: 'चौड़ाई',
};

export function defaultHindiName(fieldName: string): string | undefined {
  return HINDI_MEASUREMENT_LABELS[fieldName.trim().toLowerCase()];
}

export const SECTOR_CLIENT_PREFIX: Record<string, string> = {
  School: 'SCH',
  Corporate: 'CORP',
  Hospital: 'HOSP',
  Wholesale: 'WH',
  Hospitality: 'HOSPIT',
};
