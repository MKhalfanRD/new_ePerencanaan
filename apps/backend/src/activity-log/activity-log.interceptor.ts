import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service';

const MUTASI = ['POST', 'PATCH', 'PUT', 'DELETE'];
const RAHASIA = ['password', 'passwordHash', 'accessToken', 'token'];

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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!MUTASI.includes(req.method)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user = req.user;
        if (!user) return;
        const res = context.switchToHttp().getResponse();
        const segmen = String(req.route?.path ?? req.url)
          .split('?')[0]
          .split('/')
          .filter(Boolean);

        void this.prisma.activityLog
          .create({
            data: {
              userId: user.userId ?? null,
              username: user.username ?? '-',
              roleCode: user.role ?? null,
              method: req.method,
              path: String(req.originalUrl ?? req.url).slice(0, 255),
              entity: segmen[0] ?? null,
              entityId: req.params?.id ?? null,
              statusCode: res.statusCode ?? 200,
              ip: (req.ip ?? '').slice(0, 45) || null,
              meta: ringkas(req.body),
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}
