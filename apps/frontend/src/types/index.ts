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
}

export interface Alokasi {
  id: string;
  planningId: string;
  roId: string;
  ro: RO;
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
}

export interface LokasiAlokasi {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
}

export interface Planning {
  id: string;
  projectName: string;
  masaPelaksanaan: "SINGLE_YEAR" | "MULTI_YEAR";
  kewenangan: "PUSAT" | "DAERAH";
  status: "DRAFT" | "SUBMITTED" | "REVISION" | "REJECTED" | "APPROVED";
  catatan?: string;
  balai: Balai;
  periode: Periode;
  wilayahSungai?: { id: string; name: string };
  kebutuhanTanah: boolean;
  sesuaiRTRW?: string;
  nomorPerdaRTRW?: string;
  sesuaiPolaSDA?: string;
  nomorKepmenPUPR?: string;
  sesuaiMasterplan?: string;
  kriteriaDokumen: KriteriaDokumen[];
  majorProjects: {
    id: string;
    majorProject: { id: string; name: string };
    detail?: string;
  }[];
  tindakLanjut: { id: string; tindakLanjut: { id: string; name: string } }[];
  alokasi: Alokasi[];
  prioritas: Prioritas[];
  reviews: Review[];
  createdBy: {
    id: string;
    name: string;
    username: string;
    role: { code: string; name: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface KriteriaDokumen {
  id: string;
  jenis: string;
  status: "TIDAK_PERLU" | "BELUM_ADA" | "SUDAH_ADA";
  tahun?: number;
}

export interface Prioritas {
  id: string;
  tahun: number;
  proyekPrioritas: boolean;
  proyekRPIW: boolean;
  kegiatanBaru: boolean;
  kegiatanWajib: boolean;
  proyekKonregFKS: boolean;
  proyekMusrengbangnas: boolean;
}

export interface Review {
  id: string;
  action: string;
  catatan?: string;
  createdAt: string;
  reviewer: { id: string; name: string; username: string };
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
