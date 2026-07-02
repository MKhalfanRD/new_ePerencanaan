# Analisis Project: ePerencanaan (Full-Stack)

## Ringkasan

**ePerencanaan** adalah aplikasi web untuk sistem **perencanaan & penganggaran proyek infrastruktur Sumber Daya Air (PUPR)** — terlihat dari istilah domain seperti "Balai", "Wilayah Sungai", nomenklatur anggaran Program→Kegiatan→KRO→RO, dan skema pendanaan RM/RMP/PLN/SBSN/KPBU.

Project ini berbentuk **monorepo** (`apps/frontend` + `apps/backend`):

| Layer | Teknologi |
|---|---|
| **Frontend** | Next.js (App Router) + TypeScript, Axios, Leaflet, xlsx, jsPDF |
| **Backend** | **NestJS 11** + TypeScript, **Prisma ORM** (PostgreSQL), JWT Auth, Redis (cache), Swagger |

Dokumen ini mencakup analisis **frontend dan backend sekaligus**, termasuk skema database sesungguhnya dari Prisma.

## Stack Teknologi

### Frontend (`apps/frontend`)
- **Next.js** (App Router, route group `(dashboard)`)
- **TypeScript**
- **Axios** untuk komunikasi API (`src/lib/api.ts`) dengan interceptor JWT & auto-logout saat 401
- **Leaflet + leaflet-draw** untuk peta interaktif (titik/garis/poligon)
- **xlsx** untuk import/export Excel
- **jsPDF + jspdf-autotable** untuk export PDF
- Komponen UI custom bergaya shadcn/ui (`src/components/ui/`)

### Backend (`apps/backend`)
- **NestJS 11** (Express platform), modular per domain
- **Prisma ORM 5** dengan **PostgreSQL**
- **Autentikasi**: JWT (`@nestjs/jwt` + `passport-jwt`), password di-hash dengan **bcrypt**; dependency `argon2` juga terpasang (tersedia tapi login aktif masih pakai bcrypt)
- **Redis** (`ioredis` + `@keyv/redis` + `@nestjs/cache-manager`) sebagai cache layer, TTL default 60 detik, mendukung invalidasi cache berbasis prefix
- **class-validator / class-transformer** untuk validasi DTO
- **Swagger** (`@nestjs/swagger`) untuk dokumentasi API otomatis
- **xlsx (SheetJS)** + **multer** untuk fitur import Excel (preview → commit)
- Testing: **Jest** (unit + e2e), sudah ada beberapa `*.spec.ts` untuk auth, users, plannings

## Struktur Folder

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── plannings/page.tsx
│   │   ├── review/page.tsx
│   │   ├── users/page.tsx
│   │   ├── master/page.tsx
│   │   └── layout.tsx
│   ├── login/page.tsx
│   └── layout.tsx, globals.css, page.tsx
├── components/
│   ├── import/       -> import-excel-dialog.tsx
│   ├── layout/        -> sidebar.tsx
│   ├── map/            -> map-picker, lokasi-form/detail-dialog, cascading-wilayah
│   ├── master/        -> balai, periode, nomenklatur, major-project, tindak-lanjut, wilayah-sungai
│   ├── planning/     -> planning & alokasi form/detail dialogs
│   ├── ui/                -> button, card, dialog, select, dll. (design system)
│   └── users/          -> user-form-dialog.tsx
├── lib/
│   ├── api.ts              -> axios instance + interceptors
│   ├── export-utils.ts  -> export Excel & PDF
│   ├── wilayah-api.ts   -> API wilayah administratif Indonesia
│   └── utils.ts
├── store/
│   └── auth.ts             -> state autentikasi
└── types/
    └── index.ts             -> semua tipe domain (Planning, Alokasi, RO, dll.)
```

## Struktur Folder Backend

```
apps/backend/src/
├── auth/          -> login (JWT), guard, strategy
├── users/         -> CRUD user
├── plannings/     -> CRUD planning + submit + review workflow
├── alokasi/       -> CRUD alokasi anggaran + lokasi + histori
├── master/        -> semua data referensi (balai, periode, nomenklatur, dst.)
├── import/        -> import Excel (preview → commit)
├── wilayah/       -> proxy data wilayah administratif (provinsi/kota/kec/desa)
├── redis/         -> cache module (global)
├── prisma/        -> Prisma service (koneksi DB)
└── scripts/
apps/backend/prisma/
├── schema.prisma  -> skema database lengkap
├── seed.ts        -> seeder data awal
└── migrations/
```

## Skema Database (Prisma / PostgreSQL)

Skema database mengonfirmasi & melengkapi struktur data yang sebelumnya hanya diduga dari sisi frontend.

### Enum
| Enum | Nilai |
|---|---|
| `UserStatus` | ACTIVE, INACTIVE |
| `PlanningStatus` | DRAFT, SUBMITTED, REVISION, REJECTED, APPROVED |
| `MasaPelaksanaan` | SINGLE_YEAR, MULTI_YEAR |
| `Kewenangan` | PUSAT, DAERAH |
| `StatusDokumen` | TIDAK_PERLU, BELUM_ADA, SUDAH_ADA |
| `AllokasiStatus` | RENCANA, REALISASI |
| `TipeKoordinat` | TITIK, GARIS, POLIGON |

### Entitas Utama & Relasi

- **Role** ↔ **User** (many-to-one): role menentukan hak akses (ADMINISTRATOR/SATKER/VERIFICATOR di level data, bukan enum — jadi role bisa ditambah dinamis lewat tabel `roles`)
- **User** — punya `balaiId` (opsional), riwayat login, soft-delete (`deletedAt`)
- **Balai** — punya koordinat lokasi sendiri (`latitude`/`longitude`) dan referensi wilayah
- **Periode** — rentang tahun anggaran (`startYear`–`endYear`), hanya satu yang `isActive`
- **Nomenklatur berjenjang**: `Program` → `Kegiatan` → `KRO` → `RO` → `IndikatorRO` (4 level hierarki, masing-masing punya `code`)
- **Planning** (tabel inti) — relasi ke Balai, Periode, WilayahSungai, dan User (`createdBy`); punya soft-delete; diindeks pada `balaiId`, `status`, `createdById`, `periodeId`
  - `KriteriaDokumen` (1-ke-banyak, unique per `[planningId, jenis]`) — status kesesuaian dokumen per jenis
  - `PlanningMajorProject` & `PlanningTindakLanjut` — tabel pivot many-to-many ke Major Project & Tindak Lanjut
  - `Prioritas` — data prioritas proyek **per tahun** (unique per `[planningId, tahun]`)
  - `Alokasi` — anggaran per RO per tahun per status (unique per `[planningId, roId, tahun, status]`), dengan 5 sumber dana (rm, rmp, pln, sbsn, kpbu) + total, plus target output/outcome
    - `LokasiAlokasi` — lokasi geografis per alokasi, mendukung TITIK (lat/lng) maupun GARIS/POLIGON (`coordinates` JSON array)
    - `HistoriAlokasi` — **log perubahan** nilai alokasi (audit trail), mencatat `changedBy` & `changedAt`
  - `PlanningReview` — riwayat aksi review (approve/reject/revisi) dengan `reviewerId` & catatan

**Insight menarik**: skema ini punya **audit trail eksplisit** (`HistoriAlokasi`) dan **soft-delete** (`deletedAt` pada User & Planning) — desain yang cukup matang untuk sistem pemerintahan yang butuh jejak audit.

## Endpoint API Backend (Sesuai Controller Asli)

### Auth
| Method | Endpoint | Role |
|---|---|---|
| POST | `/auth/login` | publik |

### Plannings
| Method | Endpoint | Role |
|---|---|---|
| POST | `/plannings` | SATKER, ADMINISTRATOR |
| GET | `/plannings` | SATKER, VERIFICATOR, ADMINISTRATOR |
| GET | `/plannings/:id` | SATKER, VERIFICATOR, ADMINISTRATOR |
| PATCH | `/plannings/:id/submit` | SATKER |
| PATCH | `/plannings/:id/review` | VERIFICATOR, ADMINISTRATOR |
| PATCH | `/plannings/:id` | SATKER, ADMINISTRATOR |
| DELETE | `/plannings/:id` | SATKER, ADMINISTRATOR |

### Alokasi
| Method | Endpoint | Role |
|---|---|---|
| POST | `/alokasi` | SATKER, ADMINISTRATOR |
| GET | `/alokasi/:id` | SATKER, VERIFICATOR, ADMINISTRATOR |
| GET | `/alokasi/:id/histori` | SATKER, VERIFICATOR, ADMINISTRATOR |
| PATCH | `/alokasi/:id` | SATKER, ADMINISTRATOR |
| DELETE | `/alokasi/:id` | SATKER, ADMINISTRATOR |
| POST | `/alokasi/:id/lokasi` | SATKER, ADMINISTRATOR |
| PATCH | `/alokasi/lokasi/:lokasiId` | SATKER, ADMINISTRATOR |
| DELETE | `/alokasi/lokasi/:lokasiId` | SATKER, ADMINISTRATOR |

### Import
| Method | Endpoint | Role |
|---|---|---|
| POST | `/import/preview` | ADMINISTRATOR, SATKER |
| POST | `/import/commit` | ADMINISTRATOR, SATKER |

*(Pola preview → commit: file diparse & divalidasi dulu, ditampilkan ke user untuk konfirmasi, baru disimpan ke DB — good practice untuk mencegah import data salah secara langsung)*

### Master Data (semua di-guard JWT; endpoint tulis khusus ADMINISTRATOR)
`GET /master/{balai|periodes|programs|kegiatan|kro|ro|major-projects|tindak-lanjut|wilayah-sungai|roles}` — dapat diakses semua user login.
`POST|PATCH|DELETE` tersedia untuk semua entitas di atas (kecuali `roles`), khusus role **ADMINISTRATOR**.

### Users
| Method | Endpoint | Role |
|---|---|---|
| GET | `/users`, `/users/:id` | ADMINISTRATOR |
| POST | `/users` | ADMINISTRATOR |
| PATCH | `/users/:id`, `/users/:id/status` | ADMINISTRATOR |
| DELETE | `/users/:id` | ADMINISTRATOR |

### Wilayah (proxy wilayah administratif)
`GET /wilayah/provinces`, `/wilayah/regencies/:provinceId`, `/wilayah/districts/:regencyId`, `/wilayah/villages/:districtId` — semua butuh login, tanpa batasan role.

## Fitur yang Sudah Ada

### 1. Autentikasi & Role-based Access
- Login (`/login`) dengan JWT disimpan di `localStorage`
- Auto-redirect ke login saat token invalid/expired (401)
- 3 role pengguna: **ADMINISTRATOR**, **SATKER**, **VERIFICATOR**
- Menu sidebar menyesuaikan role yang login

### 2. Dashboard (`/dashboard`)
- Kartu statistik: total planning, draft, menunggu review, disetujui
- Total rencana anggaran (format Rupiah)
- Daftar 5 planning terbaru beserta status

### 3. Modul Planning (`/plannings`) — inti aplikasi
- CRUD planning proyek: nama proyek, balai, periode, masa pelaksanaan (single/multi year), kewenangan (pusat/daerah)
- Kriteria dokumen pendukung (kesesuaian RTRW, Pola SDA, Masterplan, dsb.) dengan status TIDAK_PERLU/BELUM_ADA/SUDAH_ADA
- Data prioritas proyek per tahun (proyek prioritas, RPIW, kegiatan baru/wajib, Konreg FKS, Musrenbangnas)
- **Alokasi anggaran** per RO (Rincian Output), dengan rincian sumber dana RM, RMP, PLN, SBSN, KPBU per tahun, status RENCANA/REALISASI, serta target output & outcome
- **Lokasi proyek berbasis peta** (Leaflet) — mendukung tipe TITIK, GARIS, atau POLIGON, terhubung ke wilayah administratif (provinsi → kota → kecamatan → desa)
- Submit planning untuk direview, hapus planning, import massal dari Excel
- Filter status, pencarian, tampilan grup (per periode/status)

### 4. Modul Review (`/review`) — role VERIFICATOR & ADMINISTRATOR
- Daftar planning berstatus `SUBMITTED` untuk diverifikasi
- Aksi **approve / reject / minta revisi** dengan catatan reviewer
- Riwayat aksi review per planning

### 5. Master Data (`/master`) — role ADMINISTRATOR
Kelola data referensi via tab:
- **Balai**
- **Periode** (tahun anggaran)
- **Nomenklatur** (hierarki Program → Kegiatan → KRO → RO)
- **Major Project**
- **Tindak Lanjut**
- **Wilayah Sungai**

### 6. Manajemen Pengguna (`/users`) — role ADMINISTRATOR
- CRUD user
- Aktivasi/nonaktifkan status akun

### 7. Import / Export
- Import planning dari file Excel (`import-excel-dialog.tsx`)
- Export ke **Excel** (ringkasan daftar planning)
- Export ke **PDF** (ringkasan & detail per planning) menggunakan jsPDF + autotable

### 8. Integrasi Wilayah
- API wilayah administratif Indonesia untuk cascading dropdown (provinsi/kota/kecamatan/desa) yang dipakai di form lokasi proyek

## Alur Bisnis (Workflow)

```
SATKER buat Planning (DRAFT)
        │
        ▼
   Submit → SUBMITTED
        │
        ▼
VERIFICATOR review
   ├─ Approve  → APPROVED
   ├─ Reject     → REJECTED
   └─ Revisi     → REVISION → (Satker perbaiki) → SUBMITTED lagi
```

## Endpoint API yang Digunakan (Ringkasan)

| Modul | Endpoint |
|---|---|
| Auth | `POST /auth/login` |
| Planning | `GET/POST /plannings`, `PATCH .../submit`, `PATCH .../review`, `DELETE /plannings/:id`, `POST /plannings/import` |
| Alokasi | `GET/POST/PATCH/DELETE /alokasi`, `/alokasi/:id/lokasi` |
| Master | `/master/balai`, `/master/periodes`, `/master/programs`, `/master/kegiatan`, `/master/kro`, `/master/ro`, `/master/major-projects`, `/master/tindak-lanjut`, `/master/wilayah-sungai` |
| Users | `GET/POST/PATCH/DELETE /users`, `PATCH /users/:id/status` |
| Wilayah | `GET /wilayah/provinces` (dan turunannya) |

## Autentikasi & Keamanan (Backend)

- Login: cek `username` + `password` (bcrypt compare) → tanda tangan JWT berisi `sub` (user id), `username`, `role`
- Proteksi endpoint dua lapis: `JwtAuthGuard` (wajib login) + `RolesGuard` dengan decorator `@Roles(...)` per endpoint — role dicek dari payload JWT, cocok dengan role dinamis di tabel `roles`
- Redis dipakai sebagai **cache layer** (bukan session store) — TTL default 60 detik, mendukung invalidasi berbasis prefix (`delByPrefix`), kemungkinan dipakai untuk cache hasil query master data atau dashboard

## Kesimpulan

Aplikasi **ePerencanaan** adalah sistem full-stack **CRUD + workflow approval** yang matang untuk pengelolaan rencana & anggaran proyek infrastruktur SDA:

- **Alur bisnis jelas**: Satker input → submit → Verificator review (approve/reject/revisi) → monitoring via dashboard
- **Model data granular**: anggaran dipecah per RO × tahun × status × 5 sumber dana, dengan audit trail (`HistoriAlokasi`) dan lokasi geografis presisi (titik/garis/poligon)
- **Keamanan berlapis**: JWT + role-based guard konsisten di seluruh endpoint backend, sinkron dengan role yang dipakai di frontend
- **Fitur pendukung lengkap**: import/export Excel & PDF, integrasi peta (Leaflet) & wilayah administratif, caching Redis

### Potensi Area untuk Ditinjau Lebih Lanjut
- Dependency `argon2` terpasang di backend tapi alur login aktif masih pakai `bcrypt` — perlu dipastikan apakah ini sisa migrasi yang belum selesai
- Field `email` pada `User` bersifat opsional (`String?`) — perlu dicek apakah ini disengaja (login berbasis username, bukan email)
- Endpoint `master/roles` hanya `GET` (tidak ada create/update role dari API) — pengelolaan role kemungkinan manual via seed/database langsung
- Belum ada endpoint khusus untuk melihat `PlanningReview` history di sisi API planning (data review tampaknya diakses lewat relasi, perlu dicek DTO response `GET /plannings/:id`)
