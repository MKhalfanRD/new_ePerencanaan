# CA tambahan untuk emsifa.com

`wilayah.service.ts` dan `prisma/scripts/import-wilayah.ts` otomatis memuat
**semua** file `.pem` di folder ini sebagai CA tambahan saat menghubungi
`emsifa.com` (lihat komentar di `wilayah.service.ts` untuk detail kenapa ini
perlu — server di belakang Cloudflare tidak selalu mengirim intermediate
certificate yang lengkap saat TLS handshake, dan Node.js tidak melakukan
AIA-fetching seperti browser).

Kalau masih menemukan `UNABLE_TO_VERIFY_LEAF_SIGNATURE` meski `we1-intermediate.pem`
sudah ada, kemungkinan Cloudflare edge server yang dihubungi memakai issuer lain.
Unduh & verifikasi langsung dari sumber resminya (jangan salin dari chat/AI),
lalu taruh sebagai file `.pem` terpisah di folder ini:

- GTS Root R4: https://pki.goog/repo/certs/gtsrootr4.pem
- GlobalSign Root CA - R4: https://secure.globalsign.com/cacert/root-r4.crt
- Let's Encrypt ISRG Root X1 / intermediate E5, E6, R3, R4: https://letsencrypt.org/certificates/

**Solusi jangka panjang yang direkomendasikan** (bukan menambah pin terus-menerus):
jalankan `prisma/scripts/import-wilayah.ts` sekali untuk meng-import seluruh data
wilayah ke database lokal. Setelah itu `WilayahService` membaca dari database,
bukan dari emsifa.com — folder ini (dan seluruh masalah TLS-nya) jadi tidak
relevan lagi untuk operasional sehari-hari, kecuali untuk refresh data sesekali.
