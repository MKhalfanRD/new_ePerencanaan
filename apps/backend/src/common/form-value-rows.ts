import { Prisma } from '@prisma/client';
import type { FormValueDto } from '../proyek/dto/preview-skor.dto';

type ItemWithOptions = {
  id: string;
  key: string;
  options: { id: string; value: string }[];
};
export type FormValueRow = {
  itemId: string;
  optionId?: string;
  valueText?: string;
  valueNumber?: number;
};

/**
 * Isian form dinamis (dicocokkan by FormItem.key) -> baris *_form_value.
 * Dipakai proyek_form_value & paket_form_value supaya format simpannya sama.
 */
export function toFormValueRows(
  items: ItemWithOptions[],
  formValues: FormValueDto[] | undefined,
): FormValueRow[] {
  const rows: FormValueRow[] = [];
  for (const f of formValues ?? []) {
    const item = items.find((i) => i.key === f.key);
    if (!item) continue;
    // Checkbox tanpa opsi yang tidak dicentang (value === false, tanpa
    // catatan) tidak perlu baris sama sekali — konsisten dengan "tidak ada
    // baris = tidak dicentang" yang dipakai form-skor.ts & hidrasi
    // formValuesMap di frontend.
    if (!item.options.length && f.value === false && !f.note) continue;
    // Checkbox multi-pilih (sumber master) -> array nilai, disimpan sebagai
    // JSON di valueText (1 baris per item, lihat storedValue()).
    if (Array.isArray(f.value)) {
      if (f.value.length)
        rows.push({ itemId: item.id, valueText: JSON.stringify(f.value) });
      continue;
    }
    const option = item.options.find((o) => o.value === String(f.value));
    rows.push({
      itemId: item.id,
      optionId: option?.id,
      valueText: option
        ? f.note
        : typeof f.value === 'string'
          ? f.value
          : f.note,
      valueNumber: typeof f.value === 'number' ? f.value : undefined,
    });
  }
  return rows;
}

/** Nilai tersimpan *_form_value -> nilai isian (kebalikan toFormValueRows). */
export function storedValue(fv: {
  item: { fieldType: string; optionSource: string | null };
  option?: { value: string } | null;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: Date | null;
}): unknown {
  if (fv.item.fieldType === 'CHECKBOX' && fv.item.optionSource && fv.valueText) {
    try {
      return JSON.parse(fv.valueText);
    } catch {
      return [fv.valueText];
    }
  }
  return (
    fv.option?.value ??
    fv.valueText ??
    fv.valueNumber ??
    fv.valueDate?.toISOString()
  );
}

/** Baris paket_form_value utk paket ber-RO `roId` — item diambil dari tab
 * Pemaketan template kegiatan RO itu (sama cara proyek menentukan template). */
export async function paketFormValueRows(
  tx: Prisma.TransactionClient,
  roId: string,
  formValues: FormValueDto[] | undefined,
): Promise<FormValueRow[]> {
  if (!formValues?.length) return [];
  const ro = await tx.rO.findUnique({
    where: { id: roId },
    select: { kro: { select: { kegiatanId: true } } },
  });
  if (!ro) return [];
  const items = await tx.formItem.findMany({
    where: {
      section: {
        tab: { key: 'pemaketan', template: { kegiatanId: ro.kro.kegiatanId } },
      },
    },
    include: { options: { where: { isActive: true } } },
  });
  return toFormValueRows(items, formValues);
}
