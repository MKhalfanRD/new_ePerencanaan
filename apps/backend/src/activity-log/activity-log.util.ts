const RAHASIA = ['password', 'passwordHash', 'accessToken', 'token'];
const FIELD_DIABAIKAN = new Set(['updatedAt', 'createdAt', 'id']);

export interface ActivityLogChange {
  field: string;
  before: any;
  after: any;
}

/**
 * Siapkan nilai satu field supaya aman disimpan di kolom JSON `meta`.
 * PENTING: `undefined` (field relasi yang sengaja diabaikan / field yang
 * tidak ada di snapshot "before") TIDAK boleh disamakan dengan `null`
 * (field yang memang kosong) — `diffEntity` bergantung pada bedanya untuk
 * tahu kapan sebuah field harus di-skip sepenuhnya dari diff.
 */
export function serialize(v: any): any {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === 'object' &&
    typeof v.toString === 'function' &&
    'toFixed' in v
  ) {
    return v.toString(); // Prisma.Decimal
  }
  if (Array.isArray(v)) {
    // String[] murni (mis. taggingDinamis) masih layak ditampilkan; array
    // relasi/objek lain tetap di-skip (undefined) supaya tidak membengkak.
    return v.every((x) => typeof x === 'string') ? v.join(', ') : undefined;
  }
  if (typeof v === 'object') return undefined; // relasi, jangan di-diff
  return v;
}

/** Bandingkan dua snapshot record (hasil findUnique, tanpa relasi) field demi field. */
export function diffEntity(before: any, after: any): ActivityLogChange[] {
  const changes: ActivityLogChange[] = [];
  for (const key of Object.keys(after)) {
    if (FIELD_DIABAIKAN.has(key) || RAHASIA.includes(key)) continue;
    const b = serialize(before?.[key]);
    const a = serialize(after[key]);
    if (b === undefined && a === undefined) continue; // field relasi/array objek, skip
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push({ field: key, before: b, after: a });
    }
  }
  return changes;
}

/** Record baru dibuat — tiap field terisi tampil sebagai "before: null". */
export function changesForCreate(after: any): ActivityLogChange[] {
  const changes: ActivityLogChange[] = [];
  for (const key of Object.keys(after ?? {})) {
    if (FIELD_DIABAIKAN.has(key) || RAHASIA.includes(key)) continue;
    const a = serialize(after[key]);
    if (a === undefined || a === null) continue;
    changes.push({ field: key, before: null, after: a });
  }
  return changes;
}

/** Record dihapus — tiap field yang pernah terisi tampil sebagai "after: null". */
export function changesForDelete(before: any): ActivityLogChange[] {
  const changes: ActivityLogChange[] = [];
  for (const key of Object.keys(before ?? {})) {
    if (FIELD_DIABAIKAN.has(key) || RAHASIA.includes(key)) continue;
    const b = serialize(before[key]);
    if (b === undefined || b === null) continue;
    changes.push({ field: key, before: b, after: null });
  }
  return changes;
}
