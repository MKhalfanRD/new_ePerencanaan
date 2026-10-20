import { BadRequestException } from '@nestjs/common';
import { StatusProyek } from '@prisma/client';
import { roleEfektif } from '../auth/role';

/**
 * Alur status proyek (docs-planning/flowchart-alur-status.pdf):
 * DRAFT -> DIAJUKAN -> DIPERIKSA -> APPROVED (Disetujui); DIKEMBALIKAN = perlu
 * revisi. Selama Diajukan/Diperiksa/Disetujui isi proyek & paket dikunci.
 */
export const STATUS_TERKUNCI: StatusProyek[] = ['DIAJUKAN', 'DIPERIKSA', 'APPROVED'];

export const LABEL_STATUS: Record<StatusProyek, string> = {
  DRAFT: 'Draft',
  DIAJUKAN: 'Diajukan',
  DIPERIKSA: 'Diperiksa',
  DIKEMBALIKAN: 'Dikembalikan',
  APPROVED: 'Disetujui',
};

/** Verifikator & Operator memeriksa proyek di kegiatannya. */
export const PEMERIKSA = ['VERIFICATOR', 'OPERATOR'];
export const pemeriksa = (user: any) => PEMERIKSA.includes(roleEfektif(user) as string);

/** Tolak perubahan isi proyek/paket/alokasi rencana selama status terkunci. */
export function cekBolehUbah(status: StatusProyek | string) {
  if (STATUS_TERKUNCI.includes(status as StatusProyek))
    throw new BadRequestException(
      `Proyek berstatus ${LABEL_STATUS[status as StatusProyek]} sehingga isinya dikunci. ` +
        'Isi proyek bisa diubah lagi setelah dikembalikan untuk revisi.',
    );
}

/** Catatan wajib untuk pengembalian (perlu revisi / kembalikan). */
export function wajibCatatan(catatan: string | undefined) {
  const c = catatan?.trim();
  if (!c || c.length < 3) throw new BadRequestException('Catatan wajib diisi saat mengembalikan proyek');
  return c;
}
