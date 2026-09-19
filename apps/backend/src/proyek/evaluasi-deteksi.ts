/**
 * Deteksi otomatis item evaluasi (MCA) yang "tercentang" dari isian form
 * Proyek — menggantikan checklist manual yang dulu ada di tab Evaluasi.
 * User TIDAK LAGI mencentang apa pun; skor dihitung dari field-field yang
 * sudah mereka isi di tab lain (Dasar Pelaksanaan, Kriteria Teknis, Tagging).
 *
 * Aturan cocok berbasis substring nama item (case-insensitive), bukan
 * NLP/fuzzy — nama item berasal dari referensi 1.xlsx (lihat
 * prisma/scripts/seed-evaluasi-referensi1.ts --dry untuk daftar lengkap per
 * kegiatan). Beberapa item SENGAJA tidak pernah cocok ke field manapun
 * karena tidak ada data pendukungnya di form (mis. "Pola dan Rencana PSDA",
 * "Kajian Balai/Masterplan", "Renstra UPT/UNOR/KL", "Direktif Presiden",
 * "Direktif DPR RI", dan sebagian besar item Valuasi selain 3 rasio di
 * bawah) — itu keterbatasan yang diwariskan dari mismatch granularitas
 * form vs master data, bukan bug. Ceiling ini bisa dinaikkan nanti kalau
 * field pendukungnya ditambahkan ke form.
 *
 * ponytail: matching substring statis, bukan mesin aturan — cukup untuk
 * ~30 item per kegiatan yang jarang berubah; upgrade ke tabel mapping
 * config-driven kalau daftar item MCA mulai sering direvisi per kegiatan.
 */

export interface ProyekEvaluasiInput {
  sumberUsulanProyek?: string | null;
  kegiatanPrioritasId?: string | null;
  tahunDed?: number | null;
  tahunDokumenLingkungan?: number | null;
  kebutuhanTanah?: boolean | null;
  kewenangan?: string | null;
  pkpnId?: string | null;
  tematikRenjaName?: string | null;
  taggingDinamis?: string[] | null;
}

export interface ValuasiRatios {
  danaPerOutput?: number | null;
  danaPerOutcome?: number | null;
  outputPerOutcome?: number | null;
  rataDanaPerOutput?: number | null;
  rataDanaPerOutcome?: number | null;
  rataOutputPerOutcome?: number | null;
}

export interface EvaluasiItemRingkas {
  id: string;
  name: string;
}

type Aturan = {
  cocok: (namaLower: string) => boolean;
  aktif: (input: ProyekEvaluasiInput, valuasi?: ValuasiRatios) => boolean;
  keterangan?: (input: ProyekEvaluasiInput) => string | undefined;
};

const ATURAN: Aturan[] = [
  {
    cocok: (n) => n.includes('usulan pemerintah daerah'),
    aktif: (i) => i.sumberUsulanProyek === 'PEMERINTAH_DAERAH',
  },
  {
    cocok: (n) =>
      n.includes('direktif dirjen sda') || n.includes('direktif menteri pu'),
    aktif: (i) => i.sumberUsulanProyek === 'KEMENTERIAN_LEMBAGA',
  },
  {
    cocok: (n) => n.includes('renaksi nasional'),
    aktif: (i) => i.sumberUsulanProyek === 'TINDAK_LANJUT_RENAKSI',
  },
  {
    cocok: (n) => n === 'rpjmn',
    aktif: (i) => !!i.kegiatanPrioritasId,
  },
  {
    cocok: (n) => n.includes('desain') || n.includes('ded'),
    aktif: (i) => i.tahunDed != null,
  },
  {
    cocok: (n) => n.includes('dokumen lingkungan'),
    aktif: (i) => i.tahunDokumenLingkungan != null,
  },
  {
    cocok: (n) => n.includes('lahan siap'),
    aktif: (i) => i.kebutuhanTanah === false,
  },
  {
    cocok: (n) => n.includes('kewenangan pusat'),
    aktif: (i) => i.kewenangan === 'PUSAT',
  },
  {
    cocok: (n) => n.includes('pkpn'),
    aktif: (i) => !!i.pkpnId,
  },
  {
    cocok: (n) => n.includes('rasio anggaran terhadap output'),
    aktif: (_i, v) =>
      v?.danaPerOutput != null &&
      v?.rataDanaPerOutput != null &&
      v.danaPerOutput < v.rataDanaPerOutput,
  },
  {
    cocok: (n) => n.includes('rasio anggaran terhadap outcome'),
    aktif: (_i, v) =>
      v?.danaPerOutcome != null &&
      v?.rataDanaPerOutcome != null &&
      v.danaPerOutcome < v.rataDanaPerOutcome,
  },
  {
    cocok: (n) => n.includes('rasio output terhadap outcome'),
    aktif: (_i, v) =>
      v?.outputPerOutcome != null &&
      v?.rataOutputPerOutcome != null &&
      v.outputPerOutcome < v.rataOutputPerOutcome,
  },
];

export function deteksiEvaluasiItemIds(
  input: ProyekEvaluasiInput,
  items: EvaluasiItemRingkas[],
  valuasi?: ValuasiRatios,
): { itemIds: string[]; keterangan: Record<string, string> } {
  const itemIds: string[] = [];
  const keterangan: Record<string, string> = {};

  for (const item of items) {
    const nama = item.name.trim().toLowerCase();

    if (ATURAN.some((a) => a.cocok(nama) && a.aktif(input, valuasi))) {
      itemIds.push(item.id);
      continue;
    }

    // "Tematik lainnya: ..." <- Tagging Dinamis (tag bebas), dan item
    // Tematik lain yang namanya cocok dengan TematikRenja yang dipilih.
    if (nama.startsWith('tematik lainnya')) {
      if (input.taggingDinamis?.length) {
        itemIds.push(item.id);
        keterangan[item.id] = input.taggingDinamis.join(', ');
      }
      continue;
    }
    if (
      input.tematikRenjaName &&
      nama.includes(input.tematikRenjaName.trim().toLowerCase())
    ) {
      itemIds.push(item.id);
    }
  }

  return { itemIds, keterangan };
}

// Self-check — npx ts-node src/proyek/evaluasi-deteksi.ts
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { strictEqual, deepStrictEqual } = require('assert');
  const items: EvaluasiItemRingkas[] = [
    { id: 'a', name: 'Usulan Pemerintah Daerah / DPRD' },
    { id: 'b', name: 'Direktif Dirjen SDA' },
    { id: 'c', name: 'RPJMN' },
    { id: 'd', name: 'Basic desain/SID/DED' },
    { id: 'e', name: 'Dokumen Lingkungan' },
    { id: 'f', name: 'Lahan Siap' },
    { id: 'g', name: 'Kewenangan Pusat' },
    { id: 'h', name: 'PKPN bidang SDA' },
    { id: 'i', name: 'Tematik lainnya: …' },
    { id: 'j', name: 'Pola dan Rencana PSDA' }, // sengaja tidak pernah cocok
  ];

  const hasil = deteksiEvaluasiItemIds(
    {
      sumberUsulanProyek: 'PEMERINTAH_DAERAH',
      kegiatanPrioritasId: 'kp1',
      tahunDed: 2022,
      tahunDokumenLingkungan: null,
      kebutuhanTanah: false,
      kewenangan: 'PUSAT',
      pkpnId: 'pkpn1',
      taggingDinamis: ['modernisasi irigasi'],
    },
    items,
  );
  deepStrictEqual(hasil.itemIds.sort(), ['a', 'c', 'd', 'f', 'g', 'h', 'i']);
  strictEqual(hasil.keterangan['i'], 'modernisasi irigasi');

  const kosong = deteksiEvaluasiItemIds({}, items);
  deepStrictEqual(kosong.itemIds, []);

  console.log('evaluasi-deteksi OK');
}
