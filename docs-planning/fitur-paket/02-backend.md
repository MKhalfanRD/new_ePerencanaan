# Rencana Perubahan Backend — Fitur Paket

Asumsi: perubahan schema di [`01-database.md`](./01-database.md) sudah diterapkan + migrasi data lama sudah jalan.

## 1. Module BARU: `paket`

Ikuti pola module lain yang sudah ada (`alokasi/`, `plannings/`):

```
apps/backend/src/paket/
  paket.controller.ts
  paket.module.ts
  paket.service.ts
  dto/
    create-paket.dto.ts
    update-paket.dto.ts
```

Tapi berdasarkan pola yang **sudah dipakai** di `plannings.service.ts` (`create()` menulis `alokasi`/`prioritas` sebagai nested write Prisma dalam satu `create` planning, bukan lewat endpoint terpisah), Paket **juga** ditulis nested di dalam create/update Planning, bukan dibuatkan endpoint CRUD sendiri untuk create awal. `paket.controller.ts` tetap dibuat, tapi isinya operasi yang memang butuh berdiri sendiri:

- `PATCH /paket/:id` — edit satu paket saja (dipakai form edit paket, tanpa perlu kirim ulang seluruh planning)
- `DELETE /paket/:id` — hapus satu paket (soft delete, isi `deletedAt`, konsisten dengan `Planning.deletedAt`)
- `GET /paket/:id` — detail satu paket (dipakai saat expand panel butuh data lengkap termasuk alokasi & lokasi)

Create paket baru pada planning yang sudah ada tetap lewat `PATCH /plannings/:id` (update planning) dengan payload `paket: [...]` — sama seperti sekarang `alokasi: [...]` bisa ditambah lewat update planning. Ini menghindari 2 cara berbeda untuk hal yang sama (create-saat-planning-baru vs create-belakangan).

## 2. `plannings.module.ts` / `plannings.service.ts`

- Import `PaketModule` (untuk akses `PaketService` kalau perlu, mis. hitung total alokasi lintas paket).
- `create()` — struktur nested write bertambah satu level:

```ts
// SEBELUM (ringkas)
alokasi: dto.alokasi ? { create: dto.alokasi.map(a => ({ ...a, ro: { connect: { id: a.roId } } })) } : undefined,

// SESUDAH
paket: dto.paket ? {
  create: dto.paket.map((p) => ({
    name: p.name,
    kodePaket: p.kodePaket,
    jenis: p.jenis,
    masaPelaksanaan: p.masaPelaksanaan,
    ro: { connect: { id: p.roId } },
    komponen: p.komponenId ? { connect: { id: p.komponenId } } : undefined,
    wilayahSungai: p.wilayahSungaiId ? { connect: { id: p.wilayahSungaiId } } : undefined,
    // ...field indikator/tags langsung di-spread dari dto
    alokasi: p.alokasi ? {
      create: p.alokasi.map((a) => ({
        tahun: a.tahun,
        status: a.status,
        rm: a.rm, rmp: a.rmp, pln: a.pln, sbsn: a.sbsn, kpbu: a.kpbu,
        outputTarget: a.outputTarget, outputUnit: a.outputUnit,
        outcomeTarget: a.outcomeTarget, outcomeUnit: a.outcomeUnit,
        lokasi: a.lokasi ? { create: a.lokasi } : undefined,
      })),
    } : undefined,
    prioritas: p.prioritas ? { create: p.prioritas } : undefined,
  })),
} : undefined,
```

- `update()` — perlu strategi yang sama dengan yang sudah dipakai untuk `alokasi` saat update planning sekarang (cek dulu implementasinya persis: apakah full-replace per submit, atau diff by id). Terapkan pola yang sama di level `paket`, satu level lebih dalam untuk `alokasi` di bawah tiap paket.
- Query `findAll`/`findOne` (baris ~30-44 di file) — tambah `include: { paket: { include: { ro: true, komponen: true, wilayahSungai: true, alokasi: { include: { lokasi: true } }, prioritas: true } } }`, hapus `alokasi`/`prioritas` langsung dari include Planning.
- **Kalkulasi total realisasi/progress** yang dipakai di list planning (grouping per Kegiatan di `plannings/page.tsx`) — sekarang totalnya harus dijumlah lintas semua Paket→Alokasi milik planning tsb, bukan langsung dari `Planning.alokasi`. Cari titik kalkulasi ini (kemungkinan di `plannings.service.ts` atau langsung di frontend dari data yang di-include) dan sesuaikan path-nya.

## 3. `create-planning.dto.ts` (dan `update-planning.dto.ts`)

- **Hapus** dari `CreatePlanningDto`: `masaPelaksanaan`, `wilayahSungaiId` (pindah ke `PaketDto`).
- **Hapus** `alokasi?: AlokasiDto[]` dan `prioritas?: PrioritasDto[]` langsung di `CreatePlanningDto` — pindah jadi nested di `PaketDto`.
- **Tambah**:

```ts
@ApiPropertyOptional({ enum: SumberUsulanProyek })
@IsOptional() @IsEnum(SumberUsulanProyek)
sumberUsulanProyek?: string;

@ApiPropertyOptional()
@IsOptional() @IsString()
sumberUsulanLainnya?: string;

@ApiPropertyOptional()
@IsOptional() @IsString()
polaRencana?: string;

@ApiPropertyOptional({ type: [PaketDto] })
@IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaketDto)
paket?: PaketDto[];
```

- `AlokasiDto` — hapus `roId` (sudah dipindah, ditentukan lewat paket induknya).
- `PrioritasDto` — tidak berubah field-nya, cuma sekarang jadi anak `PaketDto`, bukan `CreatePlanningDto`.
- `PaketDto` baru (di file yang sama atau `paket/dto/create-paket.dto.ts`, lalu di-import):

```ts
export class PaketDto {
  @IsOptional() @IsString() id?: string; // dipakai saat update, kosong = paket baru
  @IsOptional() @IsString() kodePaket?: string;
  @IsString() name: string;
  @IsString() roId: string;
  @IsOptional() @IsString() komponenId?: string;
  @IsEnum(['FISIK', 'NON_FISIK']) jenis: string;
  @IsEnum(['SINGLE_YEAR', 'MULTI_YEAR']) masaPelaksanaan: string;
  @IsOptional() @IsString() wilayahSungaiId?: string;
  @IsOptional() @IsString() dokLingStatus?: string;
  @IsOptional() @IsString() catatanPembina?: string;
  @IsOptional() @IsString() catatanSspsda?: string;
  @IsOptional() @IsString() pn?: string;
  @IsOptional() @IsString() pp?: string;
  @IsOptional() @IsString() kp?: string;
  @IsOptional() @IsString() pkpn?: string;
  @IsOptional() @IsString() sp?: string;
  @IsOptional() @IsString() isp?: string;
  @IsOptional() @IsString() satuanIsp?: string;
  @IsOptional() @IsString() sk?: string;
  @IsOptional() @IsString() isk?: string;
  @IsOptional() @IsString() satuanIsk?: string;
  @IsOptional() @IsString() iro?: string;
  @IsOptional() @IsString() satuanIro?: string;
  @IsOptional() @IsString() tematikRenja?: string;
  @IsOptional() @IsBoolean() fkb?: boolean;
  @IsOptional() @IsBoolean() fkw?: boolean;
  @IsOptional() @IsBoolean() mpa?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AlokasiDto)
  alokasi?: AlokasiDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PrioritasDto)
  prioritas?: PrioritasDto[];
}
```

(Field indikator jumlahnya banyak dan berulang polanya — kalau reviewer merasa berlebihan, ini boleh dipangkas belakangan; tapi tidak digabung jadi satu `Json` blob supaya validasi & tipe di frontend tetap eksplisit, konsisten dengan gaya DTO existing di file ini.)

`score` **tidak** ada di `PaketDto` — dihitung/di-set backend (lewat mekanisme yang menyusul), bukan diinput manual lewat form planning.

## 4. `master` module — Komponen

- `master.service.ts`: tambah `getKomponen()`, `createKomponen()`, `updateKomponen()`, `deleteKomponen()`, `bulkDeleteKomponen()` — nyontek persis pola `getKRO`/`createKRO`/dst. yang sudah ada, tinggal ganti model & parent (`kroId` → `roId`).
- `master.controller.ts`: tambah endpoint `GET/POST/PATCH/DELETE /master/komponen` sejajar dengan endpoint KRO/RO yang sudah ada.

## 5. `wilayah` module

Tidak ada perubahan wajib. Field lokasi (`LokasiAlokasi`) tetap anak `Alokasi`, cuma `Alokasi` sekarang anak `Paket` bukan `Planning` — tidak menyentuh `wilayah.service.ts`/`wilayah.controller.ts`.

## 6. `import` module (Excel)

Ini yang paling berubah selain `plannings`. `import.service.ts` sekarang harus paham struktur 2 level:

- Baris pertama tiap grup proyek (kolom Proyek terisi) → jadi 1 `Planning`.
- Baris-baris sesudahnya sampai grup proyek berikutnya (kolom Proyek kosong, kolom Paket terisi) → masing-masing jadi 1 `Paket` milik planning tsb.
- Perlu logic "carry forward": kolom Proyek cuma terisi di baris pertama, jadi saat parsing harus disimpan sebagai "proyek aktif saat ini" dan dipakai ulang untuk baris-baris Paket berikutnya sampai ketemu baris dengan kolom Proyek terisi lagi (pola umum laporan Excel bertingkat).
- Kolom StudiLayak/DED/LARAP (tahun) di-mapping ke `KriteriaDokumen` 3 baris per planning seperti disebut di overview.
- Mapping RO/Komponen: `kdRO` dari excel harus match ke `RO.id` yang sudah ada di master (kalau tidak ketemu → baris di-skip + dicatat di laporan error import, **jangan** auto-create RO baru dari file import — RO tetap dikelola lewat menu master, konsisten dengan cara `import.service.ts` menangani RO yang tidak ditemukan sekarang, kalau memang begitu polanya — cek dulu).
- `Komponen` (`KdKomponen`/`NmKomponen`) kemungkinan **boleh** auto-create saat import kalau belum ada (beda dari RO, karena Komponen jauh lebih granular dan spesifik per paket) — tapi ini keputusan produk, bukan teknis; tandai sebagai pertanyaan ke user saat implementasi, jangan diasumsikan sepihak.
- `import.dto.ts` — tambah field-field baru sesuai kolom excel (lihat pemetaan di overview).

## 7. Yang TIDAK berubah

- `auth`, `users`, `redis`, `wilayah`, hierarki nomenklatur `Program/Kegiatan/KRO/RO` yang sudah ada (cuma nambah anak baru `Komponen`), review workflow (`PlanningReview`), permission guards.
- `alokasi.controller.ts`/`alokasi.service.ts` existing — kalau ada endpoint alokasi berdiri sendiri di sana, cukup ganti sumber `roId` jadi baca dari `alokasi.paket.roId`, tidak perlu didesain ulang.

## 8. Urutan pengerjaan yang disarankan

1. Migrasi schema + migrasi data lama (01-database.md) — di environment staging dulu, backup dulu.
2. Module `paket` + `master` Komponen (CRUD dasar, tanpa nested write dulu) — supaya bisa dites sendiri sebelum disambung ke Planning.
3. Ubah `plannings.service.ts`/DTO untuk nested write `paket`.
4. Update `import.service.ts` untuk format 2 level.
5. Baru lanjut ke frontend ([`03-ui.md`](./03-ui.md)) — backend endpoint harus jalan & bisa dites lewat Swagger/Postman dulu sebelum UI dipasang di atasnya.
