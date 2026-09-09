import { useCallback, useRef, useState } from "react";

/**
 * Seleksi baris pakai checkbox: klik satu-satu, Shift-klik untuk rentang,
 * checkbox header untuk pilih semua. `orderedIds` harus urut sesuai tampilan
 * supaya rentang Shift benar. Dipakai di halaman master (pengguna, role,
 * nomenklatur) — MasterTable punya implementasi sendiri yang setara.
 *
 * Native "change" event tidak membawa shiftKey, jadi baca `shiftRef.current`
 * yang di-set di onMouseDown checkbox tepat sebelum onChange menyusul.
 */
export function useRowSelection<T extends string | number>(orderedIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());
  const lastIdx = useRef<number | null>(null);
  const shiftRef = useRef(false);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected =
    orderedIds.length > 0 && orderedIds.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      orderedIds.every((id) => prev.has(id)) ? new Set() : new Set(orderedIds),
    );
  }, [orderedIds]);

  const toggleOne = useCallback(
    (id: T, index: number, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastIdx.current !== null) {
          const [a, b] = [lastIdx.current, index].sort((x, y) => x - y);
          for (let i = a; i <= b; i++) next.add(orderedIds[i]);
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      lastIdx.current = index;
    },
    [orderedIds],
  );

  return { selected, allSelected, toggleAll, toggleOne, clear, shiftRef };
}
