/**
 * Salin Form Proyek (form_template/tab/section/item/item_option) antar DB
 * apa adanya — id dipertahankan supaya conditionItemId tetap nyambung.
 *
 *   npx ts-node prisma/scripts/sync-form-template.ts export [file]   (di lokal)
 *   npx ts-node prisma/scripts/sync-form-template.ts import [file]   (di server)
 *
 * Import MENIMPA template kegiatan yang ada di file (cascade: jawaban
 * proyek_form_value & dokumen_pendukung yang terikat item lama ikut terhapus).
 * Kegiatan yang tidak ada di DB tujuan dilewati.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const [mode, fileArg] = process.argv.slice(2);
const FILE = fileArg ?? path.join(__dirname, 'form-template-export.json');

async function exportData() {
  const data = {
    template: await prisma.formTemplate.findMany(),
    tab: await prisma.formTab.findMany(),
    section: await prisma.formSection.findMany(),
    item: await prisma.formItem.findMany(),
    option: await prisma.formItemOption.findMany(),
  };
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log(
    `Export ke ${FILE}: ${data.template.length} template, ${data.tab.length} tab, ` +
      `${data.section.length} section, ${data.item.length} item, ${data.option.length} opsi`,
  );
}

async function importData() {
  const d = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  const kegiatanAda = new Set(
    (await prisma.kegiatan.findMany({ select: { id: true } })).map((k) => k.id),
  );
  const template = d.template.filter((t: any) => kegiatanAda.has(t.kegiatanId));
  const skipped = d.template.filter((t: any) => !kegiatanAda.has(t.kegiatanId));
  if (skipped.length) {
    console.log(`Dilewati (kegiatan tidak ada): ${skipped.map((t: any) => t.kegiatanId).join(', ')}`);
  }
  const templateIds = new Set(template.map((t: any) => t.id));
  const tab = d.tab.filter((t: any) => templateIds.has(t.templateId));
  const tabIds = new Set(tab.map((t: any) => t.id));
  const section = d.section.filter((s: any) => tabIds.has(s.tabId));
  const sectionIds = new Set(section.map((s: any) => s.id));
  const item = d.item.filter((i: any) => sectionIds.has(i.sectionId));
  const itemIds = new Set(item.map((i: any) => i.id));
  const option = d.option.filter((o: any) => itemIds.has(o.itemId));

  await prisma.$transaction([
    prisma.formTemplate.deleteMany({
      where: { kegiatanId: { in: template.map((t: any) => t.kegiatanId) } },
    }),
    prisma.formTemplate.createMany({ data: template }),
    prisma.formTab.createMany({ data: tab }),
    prisma.formSection.createMany({ data: section }),
    prisma.formItem.createMany({ data: item }),
    prisma.formItemOption.createMany({ data: option }),
  ]);
  console.log(
    `Import selesai: ${template.length} template, ${tab.length} tab, ` +
      `${section.length} section, ${item.length} item, ${option.length} opsi`,
  );
}

(mode === 'export' ? exportData() : mode === 'import' ? importData() : Promise.reject(
  new Error('Pakai: export|import [file]'),
))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
