-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlanningStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "MasaPelaksanaan" AS ENUM ('SINGLE_YEAR', 'MULTI_YEAR');

-- CreateEnum
CREATE TYPE "Kewenangan" AS ENUM ('PUSAT', 'DAERAH');

-- CreateEnum
CREATE TYPE "AllokasiStatus" AS ENUM ('RENCANA', 'REALISASI');

-- CreateEnum
CREATE TYPE "TipeKoordinat" AS ENUM ('TITIK', 'GARIS', 'POLIGON');

-- CreateEnum
CREATE TYPE "JenisPaket" AS ENUM ('FISIK', 'NON_FISIK');

-- CreateEnum
CREATE TYPE "SumberUsulanProyek" AS ENUM ('PEMERINTAH_DAERAH', 'KEMENTERIAN_LEMBAGA', 'MASYARAKAT', 'TINDAK_LANJUT_RENAKSI', 'LAINNYA');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(200),
    "username" VARCHAR(50) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "nip" VARCHAR(30),
    "phone" VARCHAR(20),
    "roleId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "balaiId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balai" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "shortName" VARCHAR(100),
    "code" VARCHAR(10),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "provinceId" VARCHAR(10),
    "cityId" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodes" (
    "id" SERIAL NOT NULL,
    "startYear" SMALLINT NOT NULL,
    "endYear" SMALLINT NOT NULL,
    "label" VARCHAR(20) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kegiatan" (
    "id" VARCHAR(10) NOT NULL,
    "programId" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kro" (
    "id" VARCHAR(20) NOT NULL,
    "kegiatanId" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ro" (
    "id" VARCHAR(20) NOT NULL,
    "kroId" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "komponen" (
    "id" TEXT NOT NULL,
    "roId" VARCHAR(20) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "komponen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indikator_ro" (
    "id" TEXT NOT NULL,
    "roId" VARCHAR(20) NOT NULL,
    "nama" VARCHAR(255) NOT NULL,
    "satuan" VARCHAR(50) NOT NULL,

    CONSTRAINT "indikator_ro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prioritas_nasional" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "prioritas_nasional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_prioritas" (
    "id" TEXT NOT NULL,
    "prioritasNasionalId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "program_prioritas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kegiatan_prioritas" (
    "id" TEXT NOT NULL,
    "programPrioritasId" TEXT NOT NULL,
    "code" VARCHAR(15) NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "kegiatan_prioritas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pkpn" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "pkpn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tematik_renja" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "tematik_renja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sasaran_program" (
    "id" TEXT NOT NULL,
    "programId" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sasaran_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indikator_sasaran_program" (
    "id" TEXT NOT NULL,
    "sasaranProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "satuan" VARCHAR(50),

    CONSTRAINT "indikator_sasaran_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sasaran_kegiatan" (
    "id" TEXT NOT NULL,
    "kegiatanId" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sasaran_kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indikator_sasaran_kegiatan" (
    "id" TEXT NOT NULL,
    "sasaranKegiatanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "satuan" VARCHAR(50),

    CONSTRAINT "indikator_sasaran_kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_sungai" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "wilayah_sungai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_provinces" (
    "id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "wilayah_provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_regencies" (
    "id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "provinceId" VARCHAR(10) NOT NULL,

    CONSTRAINT "wilayah_regencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_districts" (
    "id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "regencyId" VARCHAR(10) NOT NULL,

    CONSTRAINT "wilayah_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah_villages" (
    "id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "districtId" VARCHAR(10) NOT NULL,

    CONSTRAINT "wilayah_villages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plannings" (
    "id" TEXT NOT NULL,
    "balaiId" INTEGER NOT NULL,
    "periodeId" INTEGER NOT NULL,
    "kodeProyek" VARCHAR(50),
    "projectName" TEXT NOT NULL,
    "kewenangan" "Kewenangan" NOT NULL DEFAULT 'PUSAT',
    "provinceId" VARCHAR(10),
    "cityId" VARCHAR(10),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "kebutuhanTanah" BOOLEAN NOT NULL DEFAULT false,
    "sesuaiRTRW" VARCHAR(50),
    "nomorPerdaRTRW" VARCHAR(100),
    "sesuaiPolaSDA" VARCHAR(50),
    "nomorKepmenPUPR" VARCHAR(100),
    "sesuaiMasterplan" VARCHAR(255),
    "polaRencana" VARCHAR(100),
    "tahunStudiLayak" SMALLINT,
    "tahunDed" SMALLINT,
    "tahunLarap" SMALLINT,
    "sumberUsulanProyek" "SumberUsulanProyek",
    "sumberUsulanLainnya" TEXT,
    "status" "PlanningStatus" NOT NULL DEFAULT 'DRAFT',
    "catatan" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "plannings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paket" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "kodePaket" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "roId" VARCHAR(20) NOT NULL,
    "komponenId" TEXT,
    "jenis" "JenisPaket" NOT NULL,
    "masaPelaksanaan" "MasaPelaksanaan" NOT NULL,
    "wilayahSungaiId" TEXT,
    "dokLingStatus" VARCHAR(50),
    "catatanPembina" TEXT,
    "catatanSspsda" TEXT,
    "kegiatanPrioritasId" TEXT,
    "pkpnId" TEXT,
    "indikatorSasaranProgramId" TEXT,
    "indikatorSasaranKegiatanId" TEXT,
    "indikatorRoId" TEXT,
    "tematikRenjaId" TEXT,
    "fkb" BOOLEAN NOT NULL DEFAULT false,
    "fkw" BOOLEAN NOT NULL DEFAULT false,
    "mpa" BOOLEAN NOT NULL DEFAULT false,
    "score" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "paket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alokasi" (
    "id" TEXT NOT NULL,
    "paketId" TEXT NOT NULL,
    "tahun" SMALLINT NOT NULL,
    "status" "AllokasiStatus" NOT NULL,
    "rm" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "rmp" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "pln" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "sbsn" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "kpbu" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "total" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "outputTarget" DECIMAL(10,4),
    "outputUnit" VARCHAR(50),
    "outcomeTarget" DECIMAL(10,4),
    "outcomeUnit" VARCHAR(50),
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alokasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lokasi_alokasi" (
    "id" TEXT NOT NULL,
    "alokasiId" TEXT NOT NULL,
    "name" VARCHAR(255),
    "tipeKoordinat" "TipeKoordinat" NOT NULL DEFAULT 'TITIK',
    "provinceId" VARCHAR(10),
    "provinceName" VARCHAR(100),
    "cityId" VARCHAR(10),
    "cityName" VARCHAR(100),
    "districtId" VARCHAR(10),
    "districtName" VARCHAR(100),
    "villageId" VARCHAR(10),
    "villageName" VARCHAR(100),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "coordinates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lokasi_alokasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "histori_alokasi" (
    "id" TEXT NOT NULL,
    "alokasiId" TEXT NOT NULL,
    "rm" DECIMAL(16,0) NOT NULL,
    "rmp" DECIMAL(16,0) NOT NULL,
    "pln" DECIMAL(16,0) NOT NULL,
    "sbsn" DECIMAL(16,0) NOT NULL,
    "kpbu" DECIMAL(16,0) NOT NULL,
    "total" DECIMAL(16,0) NOT NULL,
    "outputTarget" DECIMAL(10,4),
    "outcomeTarget" DECIMAL(10,4),
    "catatan" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" VARCHAR(150) NOT NULL,

    CONSTRAINT "histori_alokasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "balai_code_key" ON "balai"("code");

-- CreateIndex
CREATE INDEX "komponen_roId_idx" ON "komponen"("roId");

-- CreateIndex
CREATE UNIQUE INDEX "prioritas_nasional_code_key" ON "prioritas_nasional"("code");

-- CreateIndex
CREATE UNIQUE INDEX "program_prioritas_code_key" ON "program_prioritas"("code");

-- CreateIndex
CREATE INDEX "program_prioritas_prioritasNasionalId_idx" ON "program_prioritas"("prioritasNasionalId");

-- CreateIndex
CREATE UNIQUE INDEX "kegiatan_prioritas_code_key" ON "kegiatan_prioritas"("code");

-- CreateIndex
CREATE INDEX "kegiatan_prioritas_programPrioritasId_idx" ON "kegiatan_prioritas"("programPrioritasId");

-- CreateIndex
CREATE UNIQUE INDEX "pkpn_name_key" ON "pkpn"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tematik_renja_name_key" ON "tematik_renja"("name");

-- CreateIndex
CREATE INDEX "sasaran_program_programId_idx" ON "sasaran_program"("programId");

-- CreateIndex
CREATE INDEX "indikator_sasaran_program_sasaranProgramId_idx" ON "indikator_sasaran_program"("sasaranProgramId");

-- CreateIndex
CREATE INDEX "sasaran_kegiatan_kegiatanId_idx" ON "sasaran_kegiatan"("kegiatanId");

-- CreateIndex
CREATE INDEX "indikator_sasaran_kegiatan_sasaranKegiatanId_idx" ON "indikator_sasaran_kegiatan"("sasaranKegiatanId");

-- CreateIndex
CREATE INDEX "wilayah_regencies_provinceId_idx" ON "wilayah_regencies"("provinceId");

-- CreateIndex
CREATE INDEX "wilayah_districts_regencyId_idx" ON "wilayah_districts"("regencyId");

-- CreateIndex
CREATE INDEX "wilayah_villages_districtId_idx" ON "wilayah_villages"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "plannings_kodeProyek_key" ON "plannings"("kodeProyek");

-- CreateIndex
CREATE INDEX "plannings_balaiId_idx" ON "plannings"("balaiId");

-- CreateIndex
CREATE INDEX "plannings_status_idx" ON "plannings"("status");

-- CreateIndex
CREATE INDEX "plannings_createdById_idx" ON "plannings"("createdById");

-- CreateIndex
CREATE INDEX "plannings_periodeId_idx" ON "plannings"("periodeId");

-- CreateIndex
CREATE UNIQUE INDEX "paket_kodePaket_key" ON "paket"("kodePaket");

-- CreateIndex
CREATE INDEX "paket_planningId_idx" ON "paket"("planningId");

-- CreateIndex
CREATE INDEX "paket_roId_idx" ON "paket"("roId");

-- CreateIndex
CREATE INDEX "alokasi_tahun_idx" ON "alokasi"("tahun");

-- CreateIndex
CREATE UNIQUE INDEX "alokasi_paketId_tahun_status_key" ON "alokasi"("paketId", "tahun", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_balaiId_fkey" FOREIGN KEY ("balaiId") REFERENCES "balai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kegiatan" ADD CONSTRAINT "kegiatan_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kro" ADD CONSTRAINT "kro_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ro" ADD CONSTRAINT "ro_kroId_fkey" FOREIGN KEY ("kroId") REFERENCES "kro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "komponen" ADD CONSTRAINT "komponen_roId_fkey" FOREIGN KEY ("roId") REFERENCES "ro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indikator_ro" ADD CONSTRAINT "indikator_ro_roId_fkey" FOREIGN KEY ("roId") REFERENCES "ro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_prioritas" ADD CONSTRAINT "program_prioritas_prioritasNasionalId_fkey" FOREIGN KEY ("prioritasNasionalId") REFERENCES "prioritas_nasional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kegiatan_prioritas" ADD CONSTRAINT "kegiatan_prioritas_programPrioritasId_fkey" FOREIGN KEY ("programPrioritasId") REFERENCES "program_prioritas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sasaran_program" ADD CONSTRAINT "sasaran_program_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indikator_sasaran_program" ADD CONSTRAINT "indikator_sasaran_program_sasaranProgramId_fkey" FOREIGN KEY ("sasaranProgramId") REFERENCES "sasaran_program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sasaran_kegiatan" ADD CONSTRAINT "sasaran_kegiatan_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indikator_sasaran_kegiatan" ADD CONSTRAINT "indikator_sasaran_kegiatan_sasaranKegiatanId_fkey" FOREIGN KEY ("sasaranKegiatanId") REFERENCES "sasaran_kegiatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wilayah_regencies" ADD CONSTRAINT "wilayah_regencies_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "wilayah_provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wilayah_districts" ADD CONSTRAINT "wilayah_districts_regencyId_fkey" FOREIGN KEY ("regencyId") REFERENCES "wilayah_regencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wilayah_villages" ADD CONSTRAINT "wilayah_villages_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "wilayah_districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_balaiId_fkey" FOREIGN KEY ("balaiId") REFERENCES "balai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "periodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_roId_fkey" FOREIGN KEY ("roId") REFERENCES "ro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_komponenId_fkey" FOREIGN KEY ("komponenId") REFERENCES "komponen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_wilayahSungaiId_fkey" FOREIGN KEY ("wilayahSungaiId") REFERENCES "wilayah_sungai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_kegiatanPrioritasId_fkey" FOREIGN KEY ("kegiatanPrioritasId") REFERENCES "kegiatan_prioritas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_pkpnId_fkey" FOREIGN KEY ("pkpnId") REFERENCES "pkpn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_indikatorSasaranProgramId_fkey" FOREIGN KEY ("indikatorSasaranProgramId") REFERENCES "indikator_sasaran_program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_indikatorSasaranKegiatanId_fkey" FOREIGN KEY ("indikatorSasaranKegiatanId") REFERENCES "indikator_sasaran_kegiatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_indikatorRoId_fkey" FOREIGN KEY ("indikatorRoId") REFERENCES "indikator_ro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket" ADD CONSTRAINT "paket_tematikRenjaId_fkey" FOREIGN KEY ("tematikRenjaId") REFERENCES "tematik_renja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alokasi" ADD CONSTRAINT "alokasi_paketId_fkey" FOREIGN KEY ("paketId") REFERENCES "paket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lokasi_alokasi" ADD CONSTRAINT "lokasi_alokasi_alokasiId_fkey" FOREIGN KEY ("alokasiId") REFERENCES "alokasi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "histori_alokasi" ADD CONSTRAINT "histori_alokasi_alokasiId_fkey" FOREIGN KEY ("alokasiId") REFERENCES "alokasi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

