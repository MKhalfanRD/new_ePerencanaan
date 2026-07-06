import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
interface RoEntry {
  roCode: string;
  roName: string;
}
interface KroGroup {
  kegiatanId: string;
  kroCode: string;
  kroName: string;
  roList: RoEntry[];
}
const master: KroGroup[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'kro-ro-master.json'), 'utf-8'),
);

const pad3 = (c: string) => (/^\d+$/.test(c) ? c.padStart(3, '0') : c);

async function main() {
  const kros = await prisma.kRO.findMany({
    where: { NOT: { id: { contains: '.' } } },
    include: { roList: true },
  });

  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const k of kros) {
    const group = master.find(
      (g) => g.kegiatanId === k.kegiatanId && g.kroCode === k.code,
    );
    if (!group) {
      unmatched.push(
        `KRO id="${k.id}" code="${k.code}" kegiatanId="${k.kegiatanId}" -> TIDAK ADA di referensi`,
      );
      continue;
    }
    const roMappings: string[] = [];
    for (const ro of k.roList) {
      const padded = pad3(ro.code);
      const roRef = group.roList.find((r) => r.roCode === padded);
      if (roRef) {
        roMappings.push(`{ oldRoId: '${ro.id}', correctRoCode: '${padded}' }`);
      } else {
        unmatched.push(
          `  RO id="${ro.id}" code="${ro.code}" (parent KRO ${k.code}/${k.kegiatanId}) -> TIDAK ADA di referensi`,
        );
      }
    }
    matched.push(
      `  { oldKroId: '${k.id}', kegiatanId: '${k.kegiatanId}', correctKroCode: '${k.code}', roMappings: [${roMappings.join(', ')}] },`,
    );
  }

  console.log('=== COPAS ke MIGRATIONS di fix-legacy-kro-ro.ts ===\n');
  console.log(matched.join('\n'));

  console.log(
    '\n=== TIDAK BISA di-auto-match (perlu konfirmasi manual / referensi lain) ===\n',
  );
  console.log(unmatched.join('\n') || '(tidak ada)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
