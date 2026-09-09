/**
 * Izin di aplikasi ini ditempel ke KODE role (`@Roles('SATKER', ...)`).
 * Supaya role baru yang dibuat lewat UI — mis. `OPERATOR_7691` — tidak
 * langsung ditolak semua endpoint, tiap role boleh menunjuk satu `baseRole`:
 * template izin yang dipinjamnya. `OPERATOR_7691` dengan baseRole `SATKER`
 * lolos di semua `@Roles('SATKER')`, tapi tetap dibatasi ke kegiatannya
 * sendiri lewat `Role.kegiatanId`.
 */

/** Role yang izinnya boleh dipinjam role turunan. */
export const BASE_ROLES = [
  'ADMINISTRATOR',
  'VERIFICATOR',
  'SATKER',
  'OPERATOR',
  'MONITORING',
  'READONLY',
];

/**
 * Hanya dua role ini yang boleh lintas kegiatan. Sengaja dicek dari kode
 * role aslinya, BUKAN baseRole — kalau tidak, role turunan berbaseRole
 * ADMINISTRATOR ikut lolos dari filter kegiatan.
 */
export const LINTAS_KEGIATAN = ['SUPER_ADMIN', 'ADMINISTRATOR'];

/** Kode role yang dipakai untuk menentukan izin. */
export const roleEfektif = (user: any): string | undefined =>
  user?.baseRole || user?.role;
