# Sync ke Server (pm2)

## 1. Lokal — push
```bash
git status
git add <file>
git commit -m "pesan"
git push origin main
```

## 2. Server — pull & build
```bash
cd /var/www/eperencanaan/new_ePerencanaan
git pull origin main

cd apps/backend
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run build

cd ../frontend
npm run build

cd ../..
pm2 restart eperencanaan-backend eperencanaan-frontend
pm2 save
```

## Cek kalau error
- Error `P2022`/`P2021` (kolom/tabel tidak ada) → migration belum apply, ulangi step `prisma migrate deploy`.
- `migrate status` bilang "up to date" padahal seharusnya ada migration baru → migration file kemungkinan tidak ke-commit (cek `.gitignore`, jangan sampai ada rule `*.sql` yang ikut nge-ignore `prisma/migrations/**/*.sql`).
- Lihat log kalau proses tidak jalan setelah restart:
```bash
pm2 logs eperencanaan-backend --lines 50 --nostream
pm2 logs eperencanaan-frontend --lines 50 --nostream
```

## Catatan
- `pm2 restart` tidak build ulang — build dulu (`npm run build`) baru restart.
- `prisma generate` wajib tiap kali `schema.prisma` berubah, sebelum `npm run build`.
