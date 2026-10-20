# Evaluasi web ePerencanaan lama (dari 6 tangkapan layar, 19-10-2026)

Web lama berhenti di tingkat **proyek**. Versi baru turun sampai **paket** (Kegiatan › Balai › Proyek › Paket › alokasi per tahun per sumber dana).

## Yang dipakai user dan harus tetap ada (model mental)
1. **Rencana vs realisasi** berdampingan per tahun di tabel utama (2 baris per proyek).
2. **Histori alokasi** per item: kapan, proses (ubah), tahun, nilai per sumber dana, output/outcome, oleh siapa.
3. **Catatan wajib** setiap mengubah alokasi + "catatan sebelumnya" ditampilkan.
4. **Skala satuan** (1 : 1.000 = Rp ribu) untuk tabel besar.
5. **Lokasi** dengan peta + Provinsi/Kab/Kec/Desa + koordinat (titik).
6. Sumber dana: RM, RMP, PLN, SBSN, KPBU. Output & outcome dengan satuan.
7. Legenda sumber data: Isi ePerencanaan, Isi PraKonreg, Histori, Rencana, Realisasi.

## Masalah (pain point)
| # | Masalah | Dampak | Arah perbaikan |
|---|---|---|---|
| 1 | Filter tanpa label ("-Pilih-", "-Pilih-", "Alokasi", "-Semua Alokasi-"), centang FKB/FKW tanpa penjelasan | User menebak isi filter | Label di setiap filter, chip filter aktif |
| 2 | Ikon samar di tiap baris (U, #, tanda merah, amplop, peta dicoret, MPA, FKW) | Butuh hafalan; tidak bisa dibaca pembaca layar | Status dalam teks; aksi di menu baris/panel |
| 3 | Tingkatan dibedakan blok warna jenuh (abu tua, biru tosca, biru muda, hijau) | Ramai, sulit dicetak, warna tidak bermakna | Tingkatan lewat indentasi + tipografi (DESIGN.md) |
| 4 | Realisasi hanya ditandai ✔ dan angka di sel yang sama | Selisih tidak terlihat | Baris realisasi + selisih tertulis |
| 5 | Satuan campur: tabel Rp ribu, detail Rp penuh, histori angka mentah `98000000000` | Salah baca nilai | Format angka konsisten, satuan selalu tertulis |
| 6 | Detail & form berupa modal di atas modal, tabel lokasi/histori scroll di dalam modal | Konteks hilang, sempit | Panel/halaman detail, bukan modal bertumpuk |
| 7 | Nilai kosong tampil `null` | Terlihat rusak | "—" atau "belum diisi" |
| 8 | Kolom tahun terpotong, perlu scroll horizontal; nama proyek panjang memakan lebar | Tahun 2028–2029 tersembunyi | Kolom tahun ringkas, nama terpotong + tooltip, judul menempel |
| 9 | Tombol berwarna-warni (Ekspor hijau, Rekap biru, ikon kuning, Stok tosca) | Tidak jelas mana aksi utama | Satu aksi utama, sisanya netral |
| 10 | Histori hanya untuk alokasi, ditulis oleh kode user ("ppls") | Perubahan lain (lokasi, data proyek) tak terlacak | Riwayat proyek menyeluruh (khusus admin) |

## Arti istilah web lama (jawaban user, 19-10-2026)
| Web lama | Arti | Di versi baru |
|---|---|---|
| **Stok** / Stok ⇄ Proyek | Proyek masuk stok dulu, keluar setelah disetujui | **Tidak dipakai** |
| **FKB** | Kegiatan baru | Penanda per proyek per tahun (belum ada di schema) → kolom form + filter |
| **FKW** | Kegiatan wajib | Penanda per proyek per tahun (belum ada di schema) → kolom form + filter |
| **MPA** | Memorandum Program Anggaran | Sudah ada `proyek.mpa` (boolean) → filter + label teks |
| **U** | Asal usulan: Unit kerja SDA / Arahan BPIW | Sudah digantikan "Sumber usulan" di tab Dasar pelaksanaan |
| **#** | Tag prioritas (mis. janji presiden) | Sudah digantikan tab Dasar pelaksanaan & Tematik |
| Isi PraKonreg | — | **Tidak dibawa** |
| **Rekap** | Rekap tahunan rencana & realisasi per sumber dana, dibagi pagu & aktual | Pagu/aktual tidak dipakai; dipindah & diperkaya di **Beranda/Dashboard**: alokasi per kegiatan, tahun, proyek, balai, sumber dana |

## Keputusan lanjutan (19-10-2026)
- **Stok tidak dipakai** di versi baru (alur cukup lewat status).
- **Pagu/aktual tidak dipakai.** Rekap = total alokasi per kegiatan, sumber dana, proyek, balai (dan tahun).
- **FKB / FKW** ditandai **per proyek per tahun** oleh pengisi; sudah ada sebagai kolom centang di tab Tematik (Master Form Proyek); di wireframe dibuat tabel per tahun di langkah Tematik.
- Ikon **amplop** = ada catatan/pesan; **peta dicoret** = lokasi belum diisi. Di versi baru ditulis sebagai teks/status kelengkapan.
