/**
 * Format rupiah dipakai di drawer detail & panel alokasi.
 * - `formatRupiah`      → nilai penuh, mis. "Rp 100.000.000.000"
 * - `formatRupiahShort` → ringkas, mis. "Rp 100 M" (bulat) / "Rp 100,4 M"
 *   (ada pecahan) / "Rp 500 jt". Untuk angka < 1 juta jatuh ke nilai penuh.
 *
 * Pakai berpasangan: tampilkan `formatRupiahShort(x)` sebagai teks dan
 * `formatRupiah(x)` sebagai `title` supaya nilai persisnya tetap bisa dicek
 * lewat hover (angka realisasi butuh presisi, bukan cuma perkiraan).
 */
export const formatRupiah = (val: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val));

/** "12,5" → tampilkan 1 desimal; "12,0" → "12" (buang koma-nol). */
const ringkasAngka = (n: number) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

export const formatRupiahShort = (val: number | string) => {
  const num = Number(val);
  if (!num) return "-";
  if (Math.abs(num) >= 1_000_000_000)
    return `Rp ${ringkasAngka(num / 1_000_000_000)} M`;
  if (Math.abs(num) >= 1_000_000)
    return `Rp ${ringkasAngka(num / 1_000_000)} jt`;
  return formatRupiah(num);
};
