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

export type KriteriaEvaluasi =
  | "URGENSITAS"
  | "KESIAPAN_TEKNIS"
  | "TEMATIK"
  | "VALUASI";

export interface EvaluasiItem {
  id: string;
  kegiatanId: string;
  kriteria: KriteriaEvaluasi;
  urutan: number;
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
   * "Km") — mengunci field Satuan Output Target di form Alokasi. */
  satuan?: string | null;
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
  indikatorRO?: { id: string; nama: string; satuan: string }[];
}

export interface Komponen {
  id: string;
  code: string;
  name: string;
  roId: string;
}

export interface Paket {
  id: string;
  planningId: string;
  kodePaket?: string;
  name: string;
  roId: string;
  ro: RO;
  komponenId?: string;
  komponen?: Komponen;
  jenis: "FISIK" | "NON_FISIK";
  masaPelaksanaan: "SINGLE_YEAR" | "MULTI_YEAR";
  dokLingStatus?: string;
  catatanPembina?: string;
  catatanSspsda?: string;
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
  indikatorRoId?: string;
  indikatorRo?: { id: string; nama: string; satuan: string };
  tematikRenjaId?: string;
  tematikRenja?: { id: string; name: string };
  fkb: boolean;
  fkw: boolean;
  mpa: boolean;
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
  // Hadir kalau di-include dari endpoint alokasi (bukan dari nested Planning.paket[].alokasi)
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

export interface Planning {
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
  kegiatanPrioritasId?: string;
  kegiatanPrioritas?: KegiatanPrioritas;
  /** Skor MCA 0..1, dihitung backend dari tagging evaluasi. */
  skorEvaluasi?: string | null;
  evaluasi?: { itemId: string; keterangan?: string; item: EvaluasiItem }[];
  // StudiLayak/DED/LARAP — angka tahun polos sesuai DB.xlsx
  tahunStudiLayak?: number;
  tahunDed?: number;
  tahunLarap?: number;
  sumberUsulanProyek?: SumberUsulanProyek;
  sumberUsulanLainnya?: string;
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
