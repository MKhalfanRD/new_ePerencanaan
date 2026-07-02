# 🧠 Project Context – ePerencanaan

> **Terakhir diperbarui**: 1 Juli 2026  
> **Commit terakhir**: `5321395` – "fix import button"  
> **Branch**: `main`

---

## 1. 📊 Tech Stack

| **Area**             | **Teknologi**                                          |
| -------------------- | ------------------------------------------------------ |
| **Frontend**         | Next.js 14 (App Router), TypeScript, Tailwind CSS      |
| **UI Library**       | shadcn/ui (Dialog, Card, Select, Button, Tooltip, dll) |
| **State Management** | Zustand (auth store)                                   |
| **HTTP Client**      | Axios (custom wrapper di `lib/api.ts`)                 |
| **Icons**            | Lucide React                                           |
| **Backend**          | NestJS + Prisma + PostgreSQL                           |
| **Authentication**   | JWT (role-based: SATKER, ADMINISTRATOR, VERIFIKATOR)   |
| **Caching**          | Redis (module siap)                                    |

---

## 2. 📁 Struktur Folder (Lengkap)

### **Frontend** (`apps/frontend/src/`)

apps/
├── backend/
│ ├── prisma/
│ │ └── schema.prisma # Database schema
│ ├── src/
│ │ ├── alokasi/ # Alokasi module
│ │ ├── import/ # Import service (Excel)
│ │ ├── wilayah/ # Wilayah module (baru)
│ │ └── app.module.ts
│ └── package-lock.json
│
└── frontend/
└── src/
├── app/
│ ├── (dashboard)/
│ │ └── plannings/
│ │ └── page.tsx # ✅ Halaman utama planning
│ └── layout.tsx
├── components/
│ ├── import/
│ │ └── import-excel-dialog.tsx # ✅ Dialog import
│ ├── map/ # 🆕 Komponen peta/wilayah
│ │ ├── cascading-wilayah.tsx
│ │ ├── lokasi-detail-dialog.tsx
│ │ ├── lokasi-form-dialog.tsx
│ │ └── map-picker.tsx
│ └── planning/
│ ├── planning-form-dialog.tsx
│ ├── planning-detail-dialog.tsx
│ ├── alokasi-form-dialog.tsx
│ └── alokasi-detail-dialog.tsx
├── lib/
│ ├── api.ts # Axios config
│ └── wilayah-api.ts # 🆕 Wilayah API
├── store/
│ └── auth.ts # Zustand auth store
└── types/
└── index.ts # TypeScript types

---

## 3. Fitur yang Sudah Selesai (✅)

- ✅ **List Planning** – tampilan grouped (by kegiatan) dan flat
- ✅ **Filter Status** – DRAFT, SUBMITTED, REVISION, APPROVED, REJECTED
- ✅ **Search** – debounce 400ms, cari berdasarkan project name
- ✅ **Buat Planning** – form dialog muncul, bisa submit
- ✅ **Detail Planning** – dialog detail dengan alokasi per tahun
- ✅ **Hapus Planning** – hanya untuk status DRAFT
- ✅ **Ajukan ke Verifikator** – ubah status DRAFT/REVISION → SUBMITTED
- ✅ **Import Excel** – tombol sudah muncul dan dialog terbuka (commit terakhir)
- ✅ **Wilayah/Map** – komponen baru untuk pemilihan lokasi (cascading, map picker)

---

## 4. Issue Terakhir yang Sedang Dikerjakan 🔴

### **Masalah**: Import Excel – upload file gagal/tidak ada respons

**Deskripsi:**

- Tombol "Import Excel" sudah muncul dan dialog sudah terbuka.
- User memilih file `.xlsx`/`.xls` dan klik "Upload".
- Tidak ada notifikasi sukses/gagal, dan file tidak terupload ke server.

**Dugaan Penyebab:**

1. Endpoint `/plannings/import` mungkin belum siap di backend (meskipun ada `import.service.ts`).
2. Format file Excel tidak sesuai dengan yang diharapkan backend.
3. Ada error CORS atau validasi yang tidak tertangani dengan baik.
4. Error di console browser tidak terlihat (belum dicek dengan detail).

**Kode Dialog Import (terakhir):**

```tsx
// apps/frontend/src/components/import/import-excel-dialog.tsx
export default function ImportExcelDialog({ open, onClose, onSuccess }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return toast.error("Pilih file Excel terlebih dahulu");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/plannings/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Import berhasil");
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal import file");
    } finally {
      setUploading(false);
    }
  };
  // ...
}
```
