export function serializeDoc<T extends Record<string, unknown>>(doc: unknown): T {
  if (doc == null) return doc as unknown as T;
  if (Array.isArray(doc)) return doc.map((d) => serializeDoc(d)) as unknown as T;

  const raw =
    typeof (doc as { toObject?: Function }).toObject === 'function'
      ? (doc as { toObject: Function }).toObject({ getters: true, virtuals: true })
      : { ...(doc as Record<string, unknown>) };

  const obj: Record<string, unknown> = { ...raw };

  if (obj.customId) {
    obj.id = obj.customId;
  } else if (obj._id) {
    obj.id = String(obj._id);
  }

  delete obj._id;
  delete obj.__v;
  delete obj.password;
  delete obj.tokenHash;

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val instanceof Date) {
      obj[key] = val.toISOString();
    } else if (val && typeof val === 'object' && (val as { toObject?: Function }).toObject) {
      obj[key] = serializeDoc(val);
    } else if (Array.isArray(val)) {
      obj[key] = val.map((item) =>
        item && typeof item === 'object' ? serializeDoc(item as Record<string, unknown>) : item
      );
    } else if (val && typeof val === 'object' && (val as Map<string, unknown>).constructor === Map) {
      obj[key] = Object.fromEntries(val as Map<string, unknown>);
    }
  }

  return obj as T;
}

export function mapToObject(value: unknown): Record<string, number> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value === 'object') return value as Record<string, number>;
  return {};
}
