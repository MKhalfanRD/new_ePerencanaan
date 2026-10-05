/**
 * Field kondisional ("Tampil jika" di kanvas Form Proyek): FormItem
 * conditionItemId = KEY item pemicu, conditionValue = satu nilai atau JSON
 * array nilai. Sama persis dengan backend src/proyek/form-skor.ts.
 */
export function nilaiKondisi(conditionValue: string | null | undefined): string[] {
  if (!conditionValue) return [];
  if (conditionValue.startsWith("[")) {
    try {
      return (JSON.parse(conditionValue) as unknown[]).map(String);
    } catch {
      // bukan JSON — anggap satu nilai biasa
    }
  }
  return [conditionValue];
}

export function kondisiTerpenuhi(
  conditionValue: string | null | undefined,
  raw: unknown,
): boolean {
  const target = nilaiKondisi(conditionValue);
  const nilai = Array.isArray(raw) ? raw : [raw];
  return nilai.some((v) => v != null && v !== "" && target.includes(String(v)));
}
