# Progress Implementasi — Redesain "Drawer Bertingkat"

Referensi: `design-concept-planning.md` (konsep) & `rencana-implementasi-redesign-drawer.md` (rencana teknis).
Update terakhir: sudah selesai **Fase 0–3** dari 6 fase (0–5). Belum ada file lama yang dihapus (pembersihan ada di Fase 5).

---

## ✅ Fase 0 — Fondasi (SELESAI)

| File                                 | Status | Aksi                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui/sheet.tsx`            | Baru   | Primitive `Sheet` dibangun dari `DialogPrimitive` (sama seperti `dialog.tsx`). Varian `layer="1"` (~660px) & `layer="2"` (~440px), efek `pushed` via `data-pushed` + helper `sheetPushedProps()`, plus `SheetBreadcrumb`, `SheetHeader/Body/Footer`. |
| `components/ui/badge.tsx`            | Diubah | Tambah varian `dot` + prop `dotColor` (slate/amber/rose/emerald/blue). Varian lama tidak disentuh.                                                                                                                                                   |
| `components/shared/status-config.ts` | Baru   | Sumber tunggal `statusConfig` (planning), `dokumenStatusConfig`, `alokasiStatusConfig` — representasi jadi `dotColor`, menggantikan `className` blok warna yang tadinya terduplikasi di `page.tsx` & `planning-detail-dialog.tsx`.                   |

`dialog.tsx` & `accordion.tsx` tidak disentuh, sesuai rencana.

---

## ✅ Fase 1 — Daftar Planning: flat design (SELESAI)

**File:** `app/(dashboard)/plannings/page.tsx` (ditimpa penuh)

- Header grup Kegiatan: gradient biru → kartu putih + `border-l-4 border-l-blue-600`.
- `statusConfig` lokal dihapus → pakai `Badge variant="dot"` dari `status-config.ts`.
- `onDoubleClick` + tooltip "Klik 2x untuk detail" **dihapus** → seluruh baris jadi `role="button"` clickable (mouse & keyboard).
- Chevron kanan muncul saat hover baris sebagai afordansi pengganti tooltip.
- Progress bar realisasi: `h-1` → `h-[5px]`.
- Tombol aksi (Eye/Send/Trash) dibungkus `stopPropagation` supaya tidak bentrok dengan klik baris.

**Tidak berubah:** `canSubmit`, `canDelete`, search/filter/pagination, grouping per Kegiatan & kalkulasi total.

---

## ✅ Fase 2 — Detail Proyek → Sheet lapis-1 + Alokasi jadi accordion inline (SELESAI)

**File baru:**

- `components/planning/alokasi-expand-panel.tsx` — konten `alokasi-detail-dialog.tsx` lama dipindah ke sini (tanpa wrapper Dialog), fetch data identik.
- `components/planning/planning-detail-sheet.tsx` — pengganti `planning-detail-dialog.tsx` (file lama **belum dihapus**, menunggu Fase 5).

**File diubah:**

- `app/(dashboard)/plannings/page.tsx` — import `PlanningDetailSheet`.
- `app/(dashboard)/review/page.tsx` — ikut diupdate ke `PlanningDetailSheet` (dulunya juga pakai `PlanningDetailDialog`, tidak disebut eksplisit di rencana tapi harus ikut supaya tidak ada import putus).

**Perubahan:**

- `Dialog` → `Sheet layer="1"` dengan `SheetBreadcrumb` (`Daftar Planning › {proyek}`).
- Tabel Alokasi per tahun: grid 2-kolom kecil → list vertikal, tiap baris expand inline (`Set<string>` id alokasi) menampilkan `AlokasiExpandPanel`.
- Riwayat Perubahan jadi accordion collapsible di panel yang sama (bukan drawer baru).
- Edit Alokasi/Form Lokasi/Detail Lokasi **saat itu masih pakai Dialog lama** (baru dikonversi di Fase 3 & 4).

---

## ✅ Fase 3 — Form Edit Alokasi → Sheet lapis-2 + efek "pushed" (SELESAI)

**File diubah:**

- `components/planning/alokasi-form-dialog.tsx` — `Dialog` → `Sheet layer="2"`, breadcrumb `Daftar Planning › {proyek} › Edit Alokasi {tahun}`, footer sticky. Field/validasi/submit **tidak berubah**, hanya layout dirapikan untuk lebar 440px (sumber dana 5→2 kolom, output/outcome 2→1 kolom stacked).
- `components/planning/planning-detail-sheet.tsx` — tambah state gabungan `panelsWithSubDrawer` + `showAlokasiForm` untuk menentukan `pushed`, diterapkan ke Sheet lapis-1 lewat `sheetPushedProps()`.
- `components/planning/alokasi-expand-panel.tsx` — terima `projectName`, `onNavigateToList`, `onSubDrawerOpenChange`; melapor ke parent saat form Edit Alokasi buka/tutup (termasuk cleanup saat baris di-collapse).

**Belum:** `LokasiFormDialog` & `LokasiDetailDialog` di dalam panel masih Dialog lama (Fase 4).

---

## ⏳ Fase 4 — Form & Detail Lokasi → Sheet lapis-2 (BELUM DIKERJAKAN)

Rencana:

- `components/map/lokasi-form-dialog.tsx` → `Dialog` → `Sheet layer="2"`. `MapPicker`, `LocationSearchBox`, cascading wilayah **tidak diubah logic-nya**.
- `components/map/lokasi-detail-dialog.tsx` → dipertimbangkan turun jadi popover/expand kecil dari chip lokasi (bukan Sheet penuh), konsisten "maks 2 drawer bersamaan".

**Keputusan terbuka (belum dikonfirmasi user):** apakah "Lihat di peta" untuk lokasi yang sudah ada perlu Sheet lapis-2 penuh atau cukup popover kecil. Default rencana: popover kecil, kecuali diarahkan lain.

---

## ⏳ Fase 5 — Pembersihan & regresi (BELUM DIKERJAKAN)

- Hapus import `Dialog` yang tidak dipakai & file lama: `planning-detail-dialog.tsx`, `alokasi-detail-dialog.tsx` (setelah dipastikan tidak ada referensi tersisa).
- Audit radius/shadow sesuai tabel §4.
- Regression checklist manual end-to-end (buat planning → alokasi → lokasi → submit → review; import Excel; responsif mobile; keyboard Esc/focus-return).

---

## File yang sudah diserahkan (cek folder unduhan per fase)

| Fase | File                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 0    | `sheet.tsx`, `badge.tsx`, `status-config.ts`                                                         |
| 1    | `page.tsx` (plannings)                                                                               |
| 2    | `alokasi-expand-panel.tsx`, `planning-detail-sheet.tsx`, `plannings-page.tsx`, `review-page.tsx`     |
| 3    | `alokasi-form-dialog.tsx`, `planning-detail-sheet.tsx` (update), `alokasi-expand-panel.tsx` (update) |

## Yang tidak berubah sepanjang Fase 0–3 (dicek ulang, sesuai rencana)

- Endpoint API, DTO, validasi backend.
- Aturan permission (`canEdit`, `canSubmit`, `canReview`, `canManageAlokasi`, `canDelete`).
- Struktur data `Program → Kegiatan → KRO → RO → Alokasi → Lokasi`.
- `AlertDialog` konfirmasi hapus (tetap dialog kecil terpusat).
- `wilayah.service.ts` & fitur backend terkait lokasi — belum disentuh sama sekali (di luar cakupan Fase 4 juga, karena Fase 4 hanya migrasi wadah UI).
