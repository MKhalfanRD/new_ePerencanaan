import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service';
import {
  changesForCreate,
  changesForDelete,
  diffEntity,
} from './activity-log.util';

const MUTASI = ['POST', 'PATCH', 'PUT', 'DELETE'];
const RAHASIA = ['password', 'passwordHash', 'accessToken', 'token'];

interface ResourceDef {
  model: string;
  label: string;
  numericId?: boolean;
}

// Key = segmen URL (pola rute, bukan nilai) digabung `/`, tanpa token `:id`.
// Dipakai untuk (a) menangkap snapshot before/after per resource dan (b)
// label Indonesia yang ditampilkan di kalimat aktivitas (`meta.resource`).
// Entity dengan 2 segmen (mis. "sasaran-program/indikator") harus didaftar
// sebelum resolveResource mencoba fallback ke 1 segmen.
const RESOURCE_REGISTRY: Record<string, ResourceDef> = {
  proyek: { model: 'proyek', label: 'Proyek' },
  paket: { model: 'paket', label: 'Paket' },
  alokasi: { model: 'alokasi', label: 'Alokasi Anggaran' },
  users: { model: 'user', label: 'Pengguna' },

  'master/roles': { model: 'role', label: 'Role' },
  'master/balai': { model: 'balai', label: 'Balai', numericId: true },
  'master/periodes': { model: 'periode', label: 'Periode', numericId: true },
  'master/programs': { model: 'program', label: 'Program' },
  'master/kegiatan': { model: 'kegiatan', label: 'Kegiatan' },
  'master/kro': { model: 'kRO', label: 'KRO' },
  'master/ro': { model: 'rO', label: 'RO' },
  'master/komponen': { model: 'komponen', label: 'Komponen' },
  'master/indikator-ro': { model: 'indikatorRO', label: 'Indikator RO' },
  'master/prioritas-nasional': {
    model: 'prioritasNasional',
    label: 'Prioritas Nasional',
  },
  'master/program-prioritas': {
    model: 'programPrioritas',
    label: 'Program Prioritas',
  },
  'master/kegiatan-prioritas': {
    model: 'kegiatanPrioritas',
    label: 'Kegiatan Prioritas',
  },
  'master/pkpn': { model: 'pkpn', label: 'PKPN' },
  'master/tematik-renja': { model: 'tematikRenja', label: 'Tematik Renja' },
  'master/sumber-usulan-proyek': {
    model: 'sumberUsulanProyek',
    label: 'Sumber Usulan Proyek',
  },
  'master/tagging-dinamis': {
    model: 'taggingDinamis',
    label: 'Tagging Dinamis',
  },
  'master/sasaran-program/indikator': {
    model: 'indikatorSasaranProgram',
    label: 'Indikator Sasaran Program',
  },
  'master/sasaran-program': {
    model: 'sasaranProgram',
    label: 'Sasaran Program',
  },
  'master/sasaran-kegiatan/indikator': {
    model: 'indikatorSasaranKegiatan',
    label: 'Indikator Sasaran Kegiatan',
  },
  'master/sasaran-kegiatan': {
    model: 'sasaranKegiatan',
    label: 'Sasaran Kegiatan',
  },
  'master/wilayah-sungai': { model: 'wilayahSungai', label: 'Wilayah Sungai' },
  'master/form-tab': { model: 'formTab', label: 'Form Tab' },
  'master/form-section': { model: 'formSection', label: 'Form Section' },
  'master/form-item': { model: 'formItem', label: 'Form Item' },
  'master/form-item-option': {
    model: 'formItemOption',
    label: 'Pilihan Form Item',
  },
};

/** Cari [key, ResourceDef] dari segmen pola rute — coba key 2-segmen dulu, baru 1-segmen. */
function resolveResource(
  segmenPola: string[],
): [string, ResourceDef] | undefined {
  const bersih = segmenPola.filter((s) => !s.startsWith(':'));
  // Rute bulk-delete (POST .../bulk-delete, body {ids}) bukan mutasi satu
  // record — biarkan fallback ke ringkasan body biasa, jangan dicocokkan
  // seolah-olah ini create/update satu resource.
  if (bersih[bersih.length - 1] === 'bulk-delete') return undefined;
  if (bersih.length >= 2) {
    const dua = bersih.slice(0, 2).join('/');
    if (RESOURCE_REGISTRY[dua]) return [dua, RESOURCE_REGISTRY[dua]];
  }
  if (bersih.length >= 1 && RESOURCE_REGISTRY[bersih[0]]) {
    return [bersih[0], RESOURCE_REGISTRY[bersih[0]]];
  }
  return undefined;
}

// FormTab/FormSection/FormItem/FormItemOption cuma bermakna dalam konteks
// satu Kegiatan (lewat FormTemplate.kegiatanId) — tanpa ini, link "buka
// resource" di frontend mendarat di Kegiatan default/salah, bukan yang
// benar-benar diedit. Jalan rantai relasi via `select` bertingkat, satu
// query, bukan N+1 manual.
const FORM_KEGIATAN_SELECT: Record<string, any> = {
  'master/form-tab': { template: { select: { kegiatanId: true } } },
  'master/form-section': {
    tab: { select: { template: { select: { kegiatanId: true } } } },
  },
  'master/form-item': {
    section: {
      select: {
        tab: { select: { template: { select: { kegiatanId: true } } } },
      },
    },
  },
  'master/form-item-option': {
    item: {
      select: {
        section: {
          select: {
            tab: { select: { template: { select: { kegiatanId: true } } } },
          },
        },
      },
    },
  },
};

function digKegiatanId(obj: any): string | undefined {
  return (
    obj?.template?.kegiatanId ??
    obj?.tab?.template?.kegiatanId ??
    obj?.section?.tab?.template?.kegiatanId ??
    obj?.item?.section?.tab?.template?.kegiatanId
  );
}

async function resolveFormKegiatanId(
  prisma: PrismaService,
  key: string,
  model: string,
  id: any,
): Promise<string | undefined> {
  const select = FORM_KEGIATAN_SELECT[key];
  if (!select || id == null) return undefined;
  const row = await (prisma as any)[model]
    .findUnique({ where: { id }, select })
    .catch(() => null);
  return row ? digKegiatanId(row) : undefined;
}

/**
 * Paket & Alokasi cuma bermakna di dalam satu Proyek — dipakai frontend
 * untuk tombol "Buka Proyek terkait". `record` harus snapshot scalar (hasil
 * findUnique biasa, bukan hasil diff), supaya proyekId/paketId-nya kebaca
 * walau field itu sendiri tidak ikut berubah.
 */
async function resolveProyekId(
  prisma: PrismaService,
  resourceKey: string,
  record: any,
): Promise<string | undefined> {
  if (!record) return undefined;
  if (resourceKey === 'paket') return record.proyekId ?? undefined;
  if (resourceKey === 'alokasi' && record.paketId) {
    const p = await (prisma as any).paket
      .findUnique({ where: { id: record.paketId }, select: { proyekId: true } })
      .catch(() => null);
    return p?.proyekId ?? undefined;
  }
  return undefined;
}

/** Buang field sensitif & potong payload besar sebelum masuk kolom meta. */
function ringkas(body: any): any {
  if (!body || typeof body !== 'object') return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (RAHASIA.includes(k)) continue;
    if (Array.isArray(v)) out[k] = `[${v.length} item]`;
    else if (v && typeof v === 'object') out[k] = '{...}';
    else out[k] = v;
  }
  return out;
}

/**
 * Catat setiap mutasi yang sukses ke tabel activity_logs. Dipasang global
 * di AppModule, jadi endpoint baru otomatis ikut tercatat tanpa perlu
 * menempel dekorator sendiri-sendiri.
 *
 * Gagal menulis log TIDAK boleh menggagalkan request aslinya — logging itu
 * jejak audit, bukan bagian dari transaksi bisnis.
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    if (!MUTASI.includes(req.method)) return next.handle();

    const segmenPola = String(req.route?.path ?? req.url)
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    const entity: string | null = segmenPola[0] ?? null;
    const entityIdRaw: string | null = req.params?.id ?? null;
    const resolved = resolveResource(segmenPola);
    const [resourceKey, resource] = resolved ?? [undefined, undefined];
    const entityIdForQuery =
      resource?.numericId && entityIdRaw ? Number(entityIdRaw) : entityIdRaw;

    // Snapshot sebelum mutasi — dibutuhkan untuk update (dibandingkan dengan
    // sesudahnya) maupun delete (satu-satunya kesempatan menangkap data yang
    // akan hilang, karena semua model di atas hard-delete).
    let before: any = null;
    if (
      resource &&
      entityIdForQuery != null &&
      (req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE')
    ) {
      before = await (this.prisma as any)[resource.model]
        .findUnique({ where: { id: entityIdForQuery } })
        .catch(() => null);
    }

    // Form resource (tab/section/item/option) cuma bisa ditelusuri balik ke
    // Kegiatan-nya SEBELUM dihapus — sesudah DELETE, rantai relasinya ikut
    // hilang. Untuk PATCH/PUT/POST, id-nya tidak berubah jadi aman diambil
    // sesudah handler jalan (lihat bawah).
    let formKegiatanId: string | undefined;
    if (resourceKey && req.method === 'DELETE' && entityIdForQuery != null) {
      formKegiatanId = await resolveFormKegiatanId(
        this.prisma,
        resourceKey,
        resource!.model,
        entityIdForQuery,
      );
    }

    return next.handle().pipe(
      tap((responseBody: any) => {
        const user = req.user;
        if (!user) return;
        const res = context.switchToHttp().getResponse();

        void (async () => {
          let meta: any = ringkas(req.body);

          if (resource) {
            // Respons controller biasanya SUDAH berupa entity yang baru
            // dibuat/diupdate — dipakai langsung sebagai snapshot "after",
            // tanpa query tambahan.
            const afterDariRespons =
              responseBody && typeof responseBody === 'object' ? responseBody : null;

            let changes: ReturnType<typeof diffEntity> | undefined;
            if (req.method === 'DELETE') {
              if (before) changes = changesForDelete(before);
            } else if (before) {
              // update: pakai snapshot respons kalau cocok, fallback query ulang
              const after =
                afterDariRespons && afterDariRespons.id === before.id
                  ? afterDariRespons
                  : await (this.prisma as any)[resource.model]
                      .findUnique({ where: { id: entityIdForQuery } })
                      .catch(() => null);
              if (after) changes = diffEntity(before, after);
            } else if (req.method === 'POST' && afterDariRespons) {
              changes = changesForCreate(afterDariRespons);
            }

            // Untuk create/update, id masih ada sesudah handler jalan —
            // resolve kegiatanId di sini (delete sudah di-resolve di atas,
            // sebelum record-nya hilang).
            if (resourceKey && formKegiatanId === undefined && req.method !== 'DELETE') {
              const idUntukForm =
                req.method === 'POST' ? afterDariRespons?.id : entityIdForQuery;
              formKegiatanId = await resolveFormKegiatanId(
                this.prisma,
                resourceKey,
                resource.model,
                idUntukForm,
              );
            }

            const proyekId = await resolveProyekId(
              this.prisma,
              resourceKey!,
              before ?? afterDariRespons,
            );

            meta = {
              resource: resource.label,
              ...(formKegiatanId ? { kegiatanId: formKegiatanId } : {}),
              ...(proyekId ? { proyekId } : {}),
              ...(changes && changes.length > 0 ? { changes } : {}),
            };
          }

          await this.prisma.activityLog
            .create({
              data: {
                userId: user.userId ?? null,
                username: user.username ?? '-',
                roleCode: user.role ?? null,
                method: req.method,
                path: String(req.originalUrl ?? req.url).slice(0, 255),
                entity,
                entityId: entityIdRaw,
                statusCode: res.statusCode ?? 200,
                ip: (req.ip ?? '').slice(0, 45) || null,
                meta,
              },
            })
            .catch(() => undefined);
        })();
      }),
    );
  }
}
