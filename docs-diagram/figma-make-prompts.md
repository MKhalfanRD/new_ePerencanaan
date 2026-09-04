# Prompt Figma Make — ePerencanaan (alur inti: submit & review planning)

Cara pakai: buka **Figma Make** (figma.com/make) dengan akunmu, paste satu
blok prompt per halaman, generate, lalu sambungkan antar-frame jadi satu
prototype (fitur "link to page" Figma Make / prototype connections manual).

Urutan halaman mengikuti [activity-submit-planning.drawio](activity-submit-planning.drawio)
dan [flowchart-status-planning.drawio](flowchart-status-planning.drawio) yang
sudah dibuat.

---

## 1. Halaman "Daftar Planning" (role: Satker/Balai)

```
Buat halaman dashboard web app tema terang (light mode, ala shadcn/ui) untuk
mengelola daftar "Planning" proyek infrastruktur sumber daya air. Header
berisi judul "Planning" dan tombol "+ Tambah Planning" (biru solid) di kanan
atas, plus tombol sekunder "Import Excel".

Di bawah header: search bar dan dropdown filter status (Semua/Draft/Menunggu
Review/Perlu Revisi/Ditolak/Disetujui).

Tabel/list planning, tiap baris card menampilkan:
- Badge status berwarna: abu-abu "Draft", biru "Menunggu Review", kuning
  "Perlu Revisi", merah "Ditolak", hijau "Disetujui" — masing-masing dengan
  icon kecil (file/jam/peringatan/silang/centang).
- Nama proyek (bold), nama balai + label periode kecil di sampingnya.
- Total alokasi rencana dalam format Rupiah.
- Catatan revisi (jika ada) ditampilkan sebagai chip kuning dengan icon
  bubble chat.
- Tombol aksi kontekstual di kanan: ikon mata (lihat detail), ikon kirim
  (submit — hanya aktif kalau status Draft/Revisi), ikon sampah (hapus —
  hanya untuk Draft).

Pagination di bawah tabel (halaman pertama/sebelumnya/nomor halaman/berikutnya/terakhir).
```

---

## 2. Dialog/Sheet "Form Planning" (role: Satker/Balai — buat & edit)

```
Buat panel form slide-over dari kanan (sheet), tema terang, judul "Planning
Baru" dengan breadcrumb section di atas. Form terbagi 4 section dengan icon
masing-masing:

1. Section "Data Umum" (icon dokumen) — dropdown Balai, dropdown Periode,
   input Nama Proyek (textarea panjang), radio pilihan Masa Pelaksanaan
   (Single Year / Multi Year), radio Kewenangan (Pusat/Daerah), checkbox
   "Membutuhkan Pembebasan Lahan".
2. Section "Kesesuaian Tata Ruang" (icon peta pin) — dropdown Sesuai RTRW,
   input Nomor Perda RTRW, dropdown Sesuai Pola SDA, input Nomor Kepmen
   PUPR, input Sesuai Masterplan.
3. Section "Kriteria Dokumen" (icon file-check) — list 5 item checklist tetap
   (Dokumen Lingkungan, Studi Kelayakan, DED, Kesiapan Lahan/LARAP,
   Persetujuan Multi Year Contract), tiap item punya dropdown status
   (Tidak Perlu/Belum Ada/Sudah Ada) dan input tahun kecil di sampingnya.
4. Section "Alokasi Anggaran" (icon dompet) — tabel dinamis (tombol tambah
   baris di bawah, tombol hapus per baris), kolom: RO (dropdown), Tahun,
   Status (Rencana/Realisasi), lalu 5 kolom sumber dana (RM, RMP, PLN, SBSN,
   KPBU) sebagai input angka, kolom Target Output+Satuan, Target
   Outcome+Satuan, dan Catatan.

Footer sheet: tombol "Batal" (outline) dan "Simpan" (solid biru).
```

---

## 3. Halaman "Review Planning" (role: Verificator)

```
Buat halaman dashboard web app tema terang, judul "Review Planning" dengan
badge kuning di kanan header "X menunggu review".

Search bar + filter status (default terpilih "Menunggu Review").

List card planning yang mirip halaman Daftar Planning, tapi tiap card
menampilkan tambahan: nama pengaju ("Diajukan oleh ..."), catatan terakhir
(jika ada, chip kuning), dan ringkasan histori review terakhir ("Review
terakhir oleh ... — approve/revision/reject · tanggal"). Card di-klik untuk
membuka panel detail.

Panel detail (slide-over kanan) menampilkan seluruh data planning read-only
(sama struktur dengan form: Data Umum, Kesesuaian Tata Ruang, Kriteria
Dokumen, Alokasi Anggaran per tahun dalam tabel), lalu di bagian bawah ada
3 tombol besar: "Setujui" (hijau), "Minta Revisi" (kuning), "Tolak" (merah)
— klik salah satu memunculkan dialog kecil dengan textarea "Catatan" (wajib
untuk Revisi/Tolak, opsional untuk Setujui) dan tombol konfirmasi.
```

---

## 4. Halaman "Dashboard" (semua role — ringkasan)

```
Buat halaman dashboard web app tema terang berisi 4 kartu statistik di atas
(grid 4 kolom): "Total Planning", "Menunggu Review", "Disetujui", "Perlu
Revisi" — tiap kartu angka besar + label + ikon.

Di bawahnya: peta interaktif (leaflet-style) menampilkan pin lokasi alokasi
proyek per titik/garis/poligon, dan tabel ringkas alokasi anggaran per tahun
per sumber dana (RM/RMP/PLN/SBSN/KPBU) dalam bentuk bar chart bertumpuk.
```

---

## Tips gabungkan jadi prototype

1. Generate tiap prompt di atas sebagai frame terpisah di Figma Make.
2. Di Figma (bukan Make), buka tab **Prototype**, sambungkan tombol
   "+ Tambah Planning" → frame Form Planning, tombol kirim/submit → balik
   ke Daftar Planning dengan status berubah, tombol mata → frame Review
   Planning — mengikuti alur di `activity-submit-planning.drawio`.
3. Rujuk `flowchart-status-planning.drawio` untuk menentukan state mana
   yang perlu ditampilkan di badge status pada tiap frame.
