export interface ActivityLogChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ActivityLogRow {
  id: string;
  username: string;
  roleCode?: string | null;
  method: string;
  path: string;
  entity?: string | null;
  entityId?: string | null;
  statusCode: number;
  ip?: string | null;
  meta?: { changes?: ActivityLogChange[]; [k: string]: unknown } | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

// Nama modul yang dipahami user awam, dipetakan dari prefix endpoint teknis
// (sama dengan path @Controller() di backend).
export const MODUL: Record<string, string> = {
  proyek: "Proyek",
  paket: "Paket",
  alokasi: "Alokasi Anggaran",
  users: "Pengguna",
  master: "Master Data",
  wilayah: "Wilayah/Lokasi",
  import: "Import Excel",
  auth: "Login",
};

const AKSI: Record<string, string> = {
  POST: "Menambahkan",
  PATCH: "Mengubah",
  PUT: "Mengubah",
  DELETE: "Menghapus",
};

export function namaModul(entity?: string | null) {
  if (!entity) return "Sistem";
  return MODUL[entity] ?? entity;
}

// Field yang paling mungkin jadi "nama" record kalau di-scan dari daftar
// perubahan — urutan menentukan prioritas.
const SUBJECT_FIELDS = [
  "projectName",
  "name",
  "username",
  "title",
  "label",
  "code",
  "kodeProyek",
];

/** Cari nilai field yang paling cocok dijadikan "nama" subjek dari daftar perubahan. */
export function subjectFromChanges(
  changes: ActivityLogChange[] | undefined,
): string | undefined {
  if (!changes) return undefined;
  for (const field of SUBJECT_FIELDS) {
    const c = changes.find((ch) => ch.field === field);
    if (!c) continue;
    const v = c.after ?? c.before;
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

/** Terjemahkan satu baris log teknis jadi satu kalimat yang bisa dibaca orang awam. */
export function ceritakanAktivitas(r: ActivityLogRow): string {
  const meta = (r.meta ?? {}) as Record<string, any>;

  if (meta.source === "import" && r.entity === "proyek") {
    const aksi = meta.aksi === "replace" ? "Mengganti" : "Menambahkan";
    return `${aksi} data proyek${meta.kodeProyek ? ` "${meta.kodeProyek}"` : ""} lewat Import Excel`;
  }

  const aksi = AKSI[r.method] ?? r.method;
  const modul =
    typeof meta.resource === "string" ? meta.resource : namaModul(r.entity);
  const subjek =
    typeof meta.name === "string" ? meta.name : subjectFromChanges(meta.changes);
  const nama = subjek ? ` "${subjek}"` : "";
  const jumlahPerubahan =
    Array.isArray(meta.changes) && meta.changes.length > 0
      ? ` (${meta.changes.length} field)`
      : "";
  return `${aksi} ${modul}${nama}${jumlahPerubahan}`;
}

// Label field dalam Bahasa Indonesia per modul, dipakai saat menampilkan
// tabel perbandingan sebelum/sesudah. Modul yang belum terdaftar tampil
// pakai nama field apa adanya — cukup jelas untuk field teknis sederhana.
const FIELD_LABEL: Record<string, Record<string, string>> = {
  proyek: {
    projectName: "Nama Proyek",
    kewenangan: "Kewenangan",
    kodeProyek: "Kode Proyek",
    balaiId: "Balai",
    periodeId: "Periode",
    kebutuhanTanah: "Butuh Tanah",
    wilayahSungaiId: "Wilayah Sungai",
    sumberUsulanProyek: "Sumber Usulan",
    sumberUsulanLainnya: "Sumber Usulan (lainnya)",
    justifikasiProyek: "Justifikasi",
    tahunStudiLayak: "Tahun Studi Kelayakan",
    statusStudiLayak: "Status Studi Kelayakan",
    tahunDed: "Tahun DED",
    statusDed: "Status DED",
    tahunLarap: "Tahun LARAP",
    statusLarap: "Status LARAP",
    tahunDokumenLingkungan: "Tahun Dokumen Lingkungan",
    statusDokumenLingkungan: "Status Dokumen Lingkungan",
    kegiatanPrioritasId: "Kegiatan Prioritas",
    pkpnId: "PKPN",
    indikatorSasaranProgramId: "Indikator Sasaran Program",
    indikatorSasaranKegiatanId: "Indikator Sasaran Kegiatan",
    tematikRenjaId: "Tematik Renja",
    fkb: "FKB",
    fkw: "FKW",
    mpa: "MPA",
    taggingDinamis: "Tagging Dinamis",
    catatanPembina: "Catatan Pembina",
    catatanSspsda: "Catatan SSPSDA",
    status: "Status Proyek",
    catatan: "Catatan",
    skorEvaluasi: "Skor Evaluasi",
    deletedAt: "Dihapus pada",
  },
};

export function labelField(entity: string | null | undefined, field: string) {
  if (!entity) return field;
  return FIELD_LABEL[entity]?.[field] ?? field;
}

// Label resource (dari backend RESOURCE_REGISTRY, lihat
// activity-log.interceptor.ts) -> id tab di halaman /master. Harus tetap
// sinkron manual kalau ada resource master baru.
const MASTER_TAB: Record<string, string> = {
  Program: "nomenklatur",
  Kegiatan: "nomenklatur",
  KRO: "nomenklatur",
  RO: "nomenklatur",
  Komponen: "nomenklatur",
  "Indikator RO": "nomenklatur",
  Periode: "nomenklatur",
  Balai: "balai",
  "Wilayah Sungai": "wilayah-sungai",
  "Form Tab": "form-proyek",
  "Form Section": "form-proyek",
  "Form Item": "form-proyek",
  "Pilihan Form Item": "form-proyek",
  "Prioritas Nasional": "pnppkp",
  "Program Prioritas": "pnppkp",
  "Kegiatan Prioritas": "pnppkp",
  PKPN: "pnppkp",
  "Tematik Renja": "tagging-renja",
  "Sumber Usulan Proyek": "tagging-renja",
  "Tagging Dinamis": "tagging-renja",
  "Sasaran Program": "sasaran",
  "Indikator Sasaran Program": "sasaran",
  "Sasaran Kegiatan": "sasaran",
  "Indikator Sasaran Kegiatan": "sasaran",
};

export interface ActivityTargetLink {
  href: string;
  label: string;
}

/** Tautan "buka record ini" — cuma didukung untuk modul yang memang punya halaman tujuan. */
export function buildTargetLink(r: ActivityLogRow): ActivityTargetLink | null {
  const meta = (r.meta ?? {}) as Record<string, any>;
  const resource = typeof meta.resource === "string" ? meta.resource : undefined;

  if (r.entity === "proyek" && r.entityId) {
    return { href: `/proyek?id=${r.entityId}`, label: "Buka Proyek" };
  }

  if (r.entity === "users") {
    const subjek =
      typeof meta.name === "string" ? meta.name : subjectFromChanges(meta.changes);
    if (subjek) {
      return {
        href: `/users?q=${encodeURIComponent(subjek)}`,
        label: "Buka Pengguna",
      };
    }
    return null;
  }

  if (r.entity === "paket" || r.entity === "alokasi") {
    const proyekId =
      typeof meta.proyekId === "string" ? meta.proyekId : undefined;
    if (proyekId) {
      return { href: `/proyek?id=${proyekId}`, label: "Buka Proyek terkait" };
    }
    return null;
  }

  if (r.entity === "master" && resource) {
    if (resource === "Role") return { href: "/users", label: "Buka Role" };
    const tabId = MASTER_TAB[resource];
    if (tabId) {
      // Form Tab/Section/Item/Pilihan Form Item cuma bermakna dalam konteks
      // satu Kegiatan — tanpa kegiatanId, link cuma mendarat di Kegiatan
      // default yang mungkin bukan yang diedit.
      const kegiatanId =
        typeof meta.kegiatanId === "string" ? meta.kegiatanId : undefined;
      const qs = kegiatanId ? `&kegiatanId=${kegiatanId}` : "";
      return {
        href: `/master?tab=${tabId}${qs}`,
        label: `Buka ${resource}`,
      };
    }
  }

  return null;
}

export function formatNilai(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v === true) return "Ya";
  if (v === false) return "Tidak";
  return String(v);
}
