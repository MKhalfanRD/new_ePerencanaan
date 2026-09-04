export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
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
  wilayahSungaiId?: string;
  wilayahSungai?: { id: string; name: string };
  dokLingStatus?: string;
  catatanPembina?: string;
  catatanSspsda?: string;
  kegiatanPrioritasId?: string;
  kegiatanPrioritas?: {
    id: string;
    code: string;
    name: string;
    programPrioritas: {
      id: string;
      code: string;
      name: string;
      prioritasNasional: { id: string; code: string; name: string };
    };
  };
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
  sesuaiRTRW?: string;
  nomorPerdaRTRW?: string;
  sesuaiPolaSDA?: string;
  nomorKepmenPUPR?: string;
  sesuaiMasterplan?: string;
  polaRencana?: string;
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
