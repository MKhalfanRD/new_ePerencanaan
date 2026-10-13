import { FormFieldType, Prisma } from '@prisma/client';

/**
 * Field inti tab Pemaketan (format paket baru). Tidak bisa dihapus dari
 * kanvas — cuma diganti nama, diurutkan, dipindah bagian, disembunyikan.
 * Kalau belum ada di template (template lama / baru disalin), dibuat
 * otomatis saat template dimuat (pastikanPemaketan).
 */
type Baku = [key: string, label: string, fieldType: FormFieldType, extra?: object];

const SALDO: Baku[] = [
  ['saldoAnggaran', 'Saldo anggaran', 'NUMBER'],
  ['saldoVolumeRo', 'Saldo volume RO', 'NUMBER'],
  ['saldoVolumeIro', 'Saldo volume IRO', 'NUMBER'],
];
const PAKET_PROYEK: Baku[] = [
  ['kategoriProyek', 'Kategori proyek', 'DROPDOWN', { optionSource: 'kategoriProyek' }],
  ['satkerBolehUbahPaket', 'Satker boleh membuat & mengubah paket', 'CHECKBOX'],
  ['daftarPaket', 'Daftar paket', 'TEXT'],
];
const PER_PAKET: Baku[] = [
  ['paketSatker', 'Satker', 'DROPDOWN'],
  ['paketName', 'Nama paket', 'TEXT'],
  ['paketRo', 'KRO / RO', 'DROPDOWN'],
  ['paketKomponen', 'Komponen', 'DROPDOWN'],
  ['paketLokasiRo', 'Lokasi RO', 'CHECKBOX'],
  ['paketVolumeRo', 'Volume RO', 'NUMBER'],
  ['paketIndikatorRo', 'Indikator RO', 'DROPDOWN'],
  ['paketTahun', 'Tahun pelaksanaan', 'NUMBER'],
  ['paketAlokasi', 'Alokasi anggaran', 'NUMBER'],
  ['paketLokasi', 'Lokasi paket', 'TEXT'],
];

type TabPemaketan = Prisma.FormTabGetPayload<{
  include: { sections: { include: { items: true } } };
}>;

/** Lengkapi field inti Pemaketan 1 template. true = ada yang dibuat/dipindah. */
export async function pastikanPemaketan(
  tx: Prisma.TransactionClient,
  templateId: string,
): Promise<boolean> {
  const tab: TabPemaketan | null = await tx.formTab.findFirst({
    where: { templateId, key: 'pemaketan' },
    include: { sections: { include: { items: true }, orderBy: { order: 'asc' } } },
  });
  if (!tab) return false;
  const adaDiTab = new Set(tab.sections.flatMap((s) => s.items.map((i) => i.key)));
  const kurang = (daftar: Baku[]) => daftar.filter(([k]) => !adaDiTab.has(k));
  const kurangSaldo = kurang(SALDO);
  const kurangProyek = kurang(PAKET_PROYEK);
  const kurangPaket = kurang(PER_PAKET);
  if (!kurangSaldo.length && !kurangProyek.length && !kurangPaket.length) return false;

  const urutanLama = tab.sections.map((s) => s.id);
  const bagian = async (key: string, label: string, perPaket: boolean) =>
    tab.sections.find((s) => s.key === key) ??
    (perPaket ? tab.sections.find((s) => s.perPaket) : undefined) ??
    (await tx.formSection.create({
      data: { tabId: tab.id, key, label, perPaket },
      include: { items: true },
    }));

  const isi = async (sectionId: string, daftar: Baku[], semua: Baku[]) => {
    for (const [key, label, fieldType, extra] of daftar) {
      // Kategori proyek dulu di tab Valuasi — pindahkan (isian lama tetap).
      const lama =
        key === 'kategoriProyek'
          ? await tx.formItem.findFirst({
              where: { key, section: { tab: { templateId } } },
            })
          : null;
      if (lama) await tx.formItem.update({ where: { id: lama.id }, data: { sectionId } });
      else
        await tx.formItem.create({
          data: { sectionId, key, label, fieldType, required: key === 'paketName', ...extra },
        });
    }
    // Field inti urut sesuai format; field lain di belakangnya.
    const items = await tx.formItem.findMany({
      where: { sectionId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    const posisi = (k: string) => {
      const i = semua.findIndex(([x]) => x === k);
      return i < 0 ? semua.length : i;
    };
    const urut = [...items].sort((a, b) => posisi(a.key) - posisi(b.key));
    for (const [order, it] of urut.entries())
      await tx.formItem.update({ where: { id: it.id }, data: { order } });
  };

  const baru: string[] = [];
  const baruPaket: string[] = [];
  if (kurangSaldo.length) {
    const s = await bagian('saldo-proyek', 'Saldo', false);
    baru.push(s.id);
    await isi(s.id, kurangSaldo, SALDO);
  }
  if (kurangProyek.length) {
    const s = await bagian('paket-proyek', 'Paket', false);
    baru.push(s.id);
    await isi(s.id, kurangProyek, PAKET_PROYEK);
  }
  if (kurangPaket.length) {
    const s = await bagian('data-paket', 'Data paket', true);
    baruPaket.push(s.id);
    await isi(s.id, kurangPaket, PER_PAKET);
  }
  // Bagian baru sekali-per-proyek di atas, lalu yang sudah ada, lalu bagian
  // baru per paket.
  const urutan = [
    ...new Set([...baru.filter((id) => !urutanLama.includes(id)), ...urutanLama, ...baruPaket]),
  ];
  for (const [order, id] of urutan.entries())
    await tx.formSection.update({ where: { id }, data: { order } });
  return true;
}

/** Key inti Pemaketan per paket (tidak boleh pindah ke bagian per proyek). */
export const KEY_PER_PAKET = new Set(PER_PAKET.map(([k]) => k));
export const KEY_PROYEK_PEMAKETAN = new Set([...SALDO, ...PAKET_PROYEK].map(([k]) => k));
