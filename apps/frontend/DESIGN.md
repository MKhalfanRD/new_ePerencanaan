# Panduan UI/UX ePerencanaan

Ringkasan aturan untuk semua perubahan tampilan di aplikasi ini. Disusun dari
impeccable (mode Operate), Vercel Web Interface Guidelines, dan anti-slop,
lalu disesuaikan dengan sistem perencanaan anggaran yang penuh tabel.

## Sifat aplikasi

Aplikasi kerja (mode **Operate**): user datang untuk menyelesaikan tugas, seperti
mengisi proyek, memeriksa alokasi, dan menyetujui. Yang diutamakan: mudah
dipindai, konsisten, dan pola yang sudah dikenal. Ekspresi visual dipakai
seperlunya. Tampilan harus "menghilang" di balik pekerjaan.

## Warna

Arah visual: **Arah C** (hi-fi disetujui 20 Okt 2026, kanvas desain
"Desain Tabel Proyek ePerencanaan"). Semua warna lewat token di
`src/app/globals.css`; jangan menulis hex atau palet Tailwind (`blue-600`,
`emerald-50`, dst.) langsung di komponen.

- **Dasar:** latar putih hangat `background` (#fcfbfa), kartu putih `card`,
  teks `foreground` (#231f1c), teks redup `muted-foreground` (#6b655f),
  garis `border` (#ebe7e3) / `input` (#dcd6d0). Latar bertingkat: `tier-1`
  (#f6f3f0, paling gelap) dan `tier-2` (#faf8f6).
- **Satu aksen:** `primary` oranye bata (#b24b0a), versi lembut `primary-soft`
  (#fff1e8) untuk pilihan aktif, teks di atasnya `primary-ink` (#8f3c08).
  Aksen hanya untuk aksi utama, pilihan aktif, dan penanda status, bukan hiasan.
  Satu layar idealnya satu tombol `primary`.
- **Semantik:** `ok` (#2e7c35), `destructive` (#b63132), `warn` (#b68b16, teks
  pakai `warn-ink`), `info` (#5759a6).
- **Status proyek:** `st-draft`, `st-diajukan`, `st-dikembalikan`,
  `st-disetujui` (titik/bar) dan `st-*-ink` (teks pill). Lewat `Badge
  variant="dot"` + `status-config.ts`.
- **Sumber dana** (tervalidasi untuk buta warna, selalu urutan ini):
  `sd-rm` #c0571e, `sd-rmp` #1b589e, `sd-pln` #b68b16, `sd-sbsn` #00906f,
  `sd-kpbu` #8a428e. Warna sumber dana selalu disertai labelnya.
- **Jangan** memberi garis warna tebal di tepi kiri kartu atau baris sebagai
  hiasan. Garis tepi hanya boleh kalau menandai status nyata (mis. baris yang
  sedang dipilih).
- Jangan pakai label berwarna jenuh sebagai pembeda tingkatan. Tingkatan
  dibedakan lewat tipografi, jarak menjorok, dan latar netral bertingkat.

## Tipografi

- **Instrument Sans** untuk semua teks, **Geist Mono** hanya untuk kode/ID
  (dimuat lewat `next/font` di `layout.tsx`). Hierarki dibangun dari **ukuran
  dan ketebalan**, bukan dari ganti font atau warna.
- Skala rapat (rasio sekitar 1,125–1,2). Label memakai huruf biasa (sentence case),
  hindari label kecil berhuruf kapital semua sebagai hiasan.
- Kolom angka: `tabular-nums`, rata kanan, format lewat `Intl.NumberFormat`.
- Monospace (Geist Mono) hanya untuk kode/ID (kode proyek, kode RO), bukan untuk gaya.
- Teks panjang: `truncate` + `title`, `min-w-0` di anak flex.

## Tabel dan data berjenjang

- Kolom yang sama harus **sejajar di semua tingkat baris** (balai, kegiatan,
  proyek, paket).
- Judul kolom **menempel** (`position: sticky`) saat digulir. Konteks induk
  (Balai › Kegiatan) ikut menempel kalau barisnya panjang.
- Pembeda tingkatan: jarak menjorok bertingkat, latar netral bertingkat
  (paling gelap = tingkat tertinggi), ketebalan huruf menurun, dan teks
  tingkatan + kode dengan warna redup (mis. "Kegiatan 7691").
- Pemisah baris memakai garis tipis 1px, bukan bayangan atau kartu bersarang.
- Daftar lebih dari 50 baris: virtualisasi atau `content-visibility: auto`.
- Filter, halaman, dan baris yang dibuka sebaiknya tercermin di URL supaya
  bisa dibagikan atau dibuka ulang.

## Komponen dan state

- Setiap komponen interaktif punya state: default, hover, focus (terlihat,
  `focus-visible`), aktif, nonaktif, loading, error.
- Loading pakai skeleton di tempat konten, bukan spinner di tengah halaman.
- Empty state menjelaskan penyebab dan langkah berikutnya, bukan sekadar
  "Tidak ada data".
- Dropdown, menu, popover dirender lewat portal supaya tidak terpotong.
- Modal hanya untuk tugas yang perlu fokus penuh. Coba alternatif inline
  dulu.
- Aksi menghapus perlu konfirmasi.

## Gerak

- Transisi 150–250 ms, hanya untuk perubahan state (buka/tutup, feedback).
- Hormati `prefers-reduced-motion`. Jangan `transition: all`.

## Aksesibilitas

- Kontras teks ≥ 4,5:1 (teks besar ≥ 3:1).
- Tombol berikon saja wajib `aria-label`. Aksi pakai `<button>`, navigasi
  pakai `<a>/<Link>`.
- Semua bisa dipakai lewat keyboard. Elemen menempel tidak boleh menutupi
  elemen yang sedang difokus.

## Teks (copy)

- Bahasa Indonesia yang langsung dan aktif. Tombol menyebut aksinya
  ("Simpan Proyek", bukan "Lanjut" kalau maksudnya menyimpan).
- Pesan error menyebut masalah dan cara memperbaikinya.
- Angka dan satuan konsisten ("10,0 M", "100 jt").
- Hindari pola tulisan AI: pembuka basa-basi, kata penegas berlebihan,
  kalimat dramatis, kontras "bukan X, melainkan Y" yang tidak perlu.

## Yang dihindari (pola "generik")

Gradien hiasan, efek kaca/blur sebagai hiasan, bayangan lembut berlebihan,
radius sudut seragam besar di semua elemen, kartu bersarang, label kecil di
atas judul, titik status yang tidak menandai apa pun, angka/statistik
karangan, ikon atau emoji sebagai hiasan, animasi berulang tanpa makna.
