export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  /** Cakupan kegiatan role (mis. "7691"). null = lintas kegiatan
   * (SUPER_ADMIN/ADMINISTRATOR). */
  kegiatanId?: string | null;
  /** Template izin yang dipinjam role turunan (mis. OPERATOR_7691 -> SATKER).
   * Selalu cek lewat punyaRole() di lib/role.ts, bukan == kode role. */
  baseRole?: string | null;
}

export interface KegiatanPrioritas {
  id: string;
  code: string;
  name: string;
  programPrioritas: {
    id: string;
    code: string;
    name: string;
    prioritasNasional: { id: string; code: string; name: string };
  };
}

/** Tree PN > PP > KP lengkap dari satu request, dipakai untuk select
 * berjenjang (pilih PN dulu, lalu PP-nya, lalu KP-nya). */
export interface PrioritasNasional {
  id: string;
  code: string;
  name: string;
  programPrioritas: {
    id: string;
    code: string;
    name: string;
    kegiatanPrioritas: { id: string; code: string; name: string }[];
  }[];
}

export interface MetodeEvaluasi {
  id: string;
  name: string;
  /** 0..1, mis. 0.4 = 40% */
  bobot: number;
  urutan: number;
}

export interface EvaluasiItem {
  id: string;
  kegiatanId: string;
  metodeId: string;
  metode?: MetodeEvaluasi;
  name: string;
  score: number;
}

export interface Balai {
  id: number;
  name: string;
  shortName?: string;
  code?: string;
  latitude?: number;
  longitude?: number;
  /** Kalau false, SATKER balai ini tidak bisa membuat paket baru. */
  isActive: boolean;
}

export interface Periode {
  id: number;
  startYear: number;
  endYear: number;
  label: string;
  isActive: boolean;
}

export interface RO {
  id: string;
  name: string;
  code: string;
  /** Satuan resmi RO (kolom "Satuan RO" di referensi 1.xlsx, mis. "Unit",
   * "Km") — mengunci field Volume RO di form Alokasi. Dari master Satuan. */
  satuanId?: string | null;
  satuan?: { id: string; name: string } | null;
  /** 1 RO bisa mencakup banyak provinsi. */
  provinsi?: { id: string; provinceId: string; provinceName: string }[];
  kro: {
    id: string;
    name: string;
    code: string;
    kegiatan: {
      id: string;
      name: string;
      code: string;
      program: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
  indikatorRO?: IndikatorRO[];
}

export interface IndikatorRO {
  id: string;
  nama: string;
  roId: string;
  /** 1 Indikator RO bisa punya banyak satuan — user pilih salah satu saat
   * mengisi Alokasi. */
  satuanList?: { id: string; satuanId: string; satuan: { id: string; name: string } }[];
}

export interface Komponen {
  id: string;
  code: string;
  name: string;
  roId: string;
  satuanId?: string | null;
  satuan?: { id: string; name: string } | null;
}

export interface Paket {
  id: string;
  proyekId: string;
  kodePaket?: string;
  name: string;
  roId: string;
  ro: RO;
  komponenId?: string;
  komponen?: Komponen;
  jenis: "FISIK" | "NON_FISIK";
  masaPelaksanaan: "SINGLE_YEAR" | "MULTI_YEAR";
  dokLingStatus?: string;
  indikatorRoId?: string;
  indikatorRo?: IndikatorRO;
  // Untuk ranking prioritas antar paket — algoritma penilaian menyusul.
  score?: string;
  alokasi: Alokasi[];
}

export interface Alokasi {
  id: string;
  paketId: string;
  tahun: number;
  status: "RENCANA" | "REALISASI";
  rm: string;
  rmp: string;
  pln: string;
  sbsn: string;
  kpbu: string;
  total: string;
  outputTarget?: string;
  outputUnit?: string;
  outcomeTarget?: string;
  outcomeUnit?: string;
  catatan?: string;
  updatedAt: string;
  lokasi: LokasiAlokasi[];
  // Hadir kalau di-include dari endpoint alokasi (bukan dari nested Proyek.paket[].alokasi)
  paket?: Paket;
}

export interface LokasiAlokasi {
  id: string;
  name?: string;
  tipeKoordinat: "TITIK" | "GARIS" | "POLIGON";
  latitude?: number;
  longitude?: number;
  coordinates?: number[][];
  provinceId?: string;
  provinceName?: string;
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  villageId?: string;
  villageName?: string;
  createdAt: string;
}

export type SumberUsulanProyek =
  | "PEMERINTAH_DAERAH"
  | "KEMENTERIAN_LEMBAGA"
  | "MASYARAKAT"
  | "TINDAK_LANJUT_RENAKSI"
  | "LAINNYA";

export interface DokumenPendukung {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Proyek {
  id: string;
  kodeProyek?: string;
  projectName: string;
  kewenangan: "PUSAT" | "DAERAH";
  status: "DRAFT" | "APPROVED";
  catatan?: string;
  balai: Balai;
  periode: Periode;
  kebutuhanTanah: boolean;
  wilayahSungaiId?: string;
  wilayahSungai?: { id: string; name: string };

  // === Dasar Pelaksanaan ===
  sumberUsulanProyek?: SumberUsulanProyek;
  sumberUsulanLainnya?: string;
  justifikasiProyek?: string;

  // === Kriteria Teknis === StudiLayak/DED/LARAP — angka tahun polos sesuai DB.xlsx
  tahunStudiLayak?: number;
  tahunDed?: number;
  tahunLarap?: number;
  tahunDokumenLingkungan?: number;

  // === Tagging === RPJMN (PN>PP>KP), RENSTRA (SP/ISP, SK/ISK), RENJA (Tematik, PKPN)
  kegiatanPrioritasId?: string;
  kegiatanPrioritas?: KegiatanPrioritas;
  pkpnId?: string;
  pkpn?: { id: string; name: string };
  indikatorSasaranProgramId?: string;
  indikatorSasaranProgram?: {
    id: string;
    name: string;
    satuan?: string;
    sasaranProgram: { id: string; name: string };
  };
  indikatorSasaranKegiatanId?: string;
  indikatorSasaranKegiatan?: {
    id: string;
    name: string;
    satuan?: string;
    sasaranKegiatan: { id: string; name: string };
  };
  tematikRenjaId?: string;
  tematikRenja?: { id: string; name: string };
  fkb: boolean;
  fkw: boolean;
  mpa: boolean;
  taggingDinamis: string[];

  // === Dokumen & Catatan ===
  dokumenPendukung?: DokumenPendukung[];
  catatanPembina?: string;
  catatanSspsda?: string;

  /** Skor MCA 0..1, dideteksi & dihitung otomatis oleh backend — TIDAK
   * pernah diisi manual dari form. */
  skorEvaluasi?: string | null;
  evaluasi?: { itemId: string; keterangan?: string; item: EvaluasiItem }[];

  paket: Paket[];
  createdBy: {
    id: string;
    name: string;
    username: string;
    role: { code: string; name: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
