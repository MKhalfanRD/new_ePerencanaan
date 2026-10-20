# Jawaban pertanyaan riset UX (tahap 1)

Pertanyaan ada di `riset-ux-tahap-1.pdf` bagian 8. Status: **lengkap** (19 Oktober 2026).

| No | Pertanyaan | Jawaban user |
|---|---|---|
| 1 | Siapa yang memeriksa & menyetujui, urutannya? | Super admin / admin |
| 2 | Bisa dikembalikan untuk revisi? Siapa, perlu catatan? | Ya, **ada catatan**. Yang mengembalikan: super admin / admin |
| 3 | Tugas Verifikator; apakah pembina peran tersendiri? | Verifikator, Operator, Admin, Super Admin **mengecek proyek yang dibuat balai** untuk disetujui atau dikembalikan karena revisi. **Pembina** = pihak yang pertama diberi akses oleh admin untuk membuat/mengedit form proyek sesuai kegiatannya. Pembina tidak mungkin membuat semua proyek sendiri, jadi punya **bawahan** yang membantu mengisi form; itulah alasan ada toggle "boleh membuat/mengubah paket" di tab Pemaketan |
| 4 | Jumlah akun per peran | User bertanya: apakah harus ada batasan? (dijawab: bukan batasan, hanya untuk mengukur skala desain) |
| 5 | Kapan sistem paling sibuk | Sepertinya selalu sibuk |
| 6 | Isi satu per satu lewat form atau massal lewat import? | Dulu satu per satu lewat form; sekarang mau lewat **import/export**. Hasil import (bisa **ribuan sekaligus**) perlu dicek lagi, butuh **cara mudah memeriksa hasil import**. **Input satu per satu tetap dibutuhkan** |
| 7 | Laporan yang biasa diminta atasan | **Alokasi rencana dan realisasi per kegiatan**; **total proyek** dan **total proyek per kegiatan**; di tiap kegiatan terlihat **balai-balainya**, berapa **saldo yang diberikan**, berapa **yang sudah dipakai**, dan **sisanya** |
| 8 | Bentuk laporan | **PDF dan Excel** |

## Konfirmasi lanjutan (tahap 2, 19 Oktober 2026)

| No | Hal | Jawaban user |
|---|---|---|
| K1 | Peran pemeriksa | **Verifikator/Operator juga boleh langsung mengembalikan** (selain Admin/Super Admin) |
| K2 | Pembina | **Hanya mengisi** usulan proyek. Mengatur susunan form = Master Data, **Master hanya untuk Admin & Super Admin** |
| K3 | Saldo per balai | Ditetapkan **Admin & Super Admin**, **per tahun** |
| K4 | Realisasi | Dibahas **sekarang**, masuk alur ini |

## Realisasi & saldo balai (19 Oktober 2026)

| No | Hal | Jawaban user |
|---|---|---|
| R1 | Siapa & seberapa sering realisasi diisi | "Sepertinya bisa kapan saja diisi" (siapa yang mengisi belum disebut) |
| R2 | Tingkat data realisasi | **Per paket per tahun per sumber dana** (sama dengan rencana) |
| R3 | Saldo balai "dipakai" | Admin memberi saldo (mis. 1 M). Saat user membuat proyek terlihat **saldo tersedia**; di tab Pemaketan saldo tersedia tampil dan **langsung berkurang** saat kolom anggaran diisi. Untuk realisasi: dihitung dari rencana paket; mis. rencana paket 10 jt (tersedia 990 jt), realisasi 5 jt → **selisih kembali**, tersedia jadi 995 jt |

| R4 | Siapa mengisi realisasi | **Pengisi balai/satker**; **admin tetap bisa mengecek** apakah realisasinya benar |
| R5 | Kapan rencana memotong saldo | **Sejak disimpan, termasuk Draft** (kembali bila paket dihapus / usulan ditolak) |
| R6 | Realisasi > rencana paket | **Tidak boleh disimpan** |
| R7 | Saldo anggaran | **Ditetapkan per KEGIATAN (per tahun)**, bukan per balai/proyek. Balai di kegiatan itu memakai saldo kegiatan bersama; laporan memisahkan **berapa yang dipakai tiap balai**. (Mengoreksi K3.) Nasib saldo volume RO/IRO per proyek belum dibahas |

## Konfirmasi tahap 3 (19 Oktober 2026)

| No | Hal | Jawaban user |
|---|---|---|
| T1 | Saldo volume RO & IRO | **Tetap per proyek** (saldo anggaran pindah ke kegiatan per tahun) |
| T2 | Verifikator/Operator | **Hanya memberikan hasil verifikasi: setuju atau ada revisi** (bila revisi → dikembalikan dengan catatan). Persetujuan akhir oleh Admin/Super Admin |
| T3 | Pembina | **Boleh** mengisi realisasi dan melihat laporan kegiatannya |
| T4 | Kebutuhan baru: riwayat proyek | Log create/update **per proyek**, tampil **di dalam proyek itu**, **hanya bisa dilihat admin**. Isinya harus jelas dan mencakup **semua yang ada di proyek** (bukan hanya paket): semua kolom & isian form, paket, alokasi per tahun, lokasi, dokumen, status |

**Kondisi log sekarang (dicek dari kode):** hanya mencatat kolom tabel proyek itu sendiri; perubahan paket/alokasi/lokasi/dokumen/isian form dinamis tidak terhubung ke riwayat proyek; nama kolom tampil sebagai kode teknis (mis. `saldoAnggaran`, `balaiId: 9`); halaman log hanya satu (global) dan hanya untuk Super Admin.

## Implikasi & hal yang masih perlu dipastikan

- Jalur import massal menjadi jalur utama → perlu alur **pemeriksaan hasil import skala ribuan**. Form satu per satu tetap ada; keduanya menghasilkan data & status yang sama.
- Pengembalian revisi wajib membawa **catatan**.
- **Perlu dipastikan:** pemeriksa (Verifikator/Operator) hanya memeriksa & memberi catatan, sedangkan keputusan setuju/kembalikan di Admin/Super Admin (sesuai jawaban 1–2)? Atau Verifikator/Operator juga boleh mengembalikan (sesuai jawaban 3)?
- **Perlu dipastikan:** "membuat/mengedit form proyek" oleh pembina = mengisi usulan proyek kegiatannya, atau juga mengatur kanvas Form Proyek di Master Data?
- **Celah data:** laporan butuh **saldo per balai per kegiatan** (diberikan / dipakai / sisa). Saat ini saldo hanya ada **per proyek** (diisi manual di tab Pemaketan); belum ada pagu per balai per kegiatan.
- **Celah fitur:** laporan butuh **realisasi**, sedangkan realisasi saat ini **dibekukan** (keputusan 13 Okt) → perlu dijadwalkan.
- Keluaran pimpinan harus bisa diekspor sebagai **PDF dan Excel**.
