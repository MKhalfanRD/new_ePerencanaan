import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BASE_ROLES } from '../auth/role';

@Injectable()
export class MasterService {
  constructor(private prisma: PrismaService) {}

  /**
   * Hapus banyak baris sekaligus by id. Dipakai fitur "pilih pakai checkbox
   * lalu Hapus" di halaman master. Prisma tetap menolak baris yang masih
   * dirujuk FK — errornya diteruskan ke klien apa adanya.
   */
  private async bulkDelete(
    model: { deleteMany: (args: any) => Promise<{ count: number }> },
    ids: (string | number)[],
    label: string,
  ) {
    const result = await model.deleteMany({ where: { id: { in: ids } } });
    return {
      message: `${result.count} ${label} berhasil dihapus`,
      count: result.count,
    };
  }

  bulkDeleteBalai(ids: (string | number)[]) {
    return this.bulkDelete(this.prisma.balai, ids.map(Number), 'Balai');
  }
  bulkDeleteWilayahSungai(ids: string[]) {
    return this.bulkDelete(this.prisma.wilayahSungai, ids, 'Wilayah Sungai');
  }
  bulkDeleteIndikatorRO(ids: string[]) {
    return this.bulkDelete(this.prisma.indikatorRO, ids, 'Indikator RO');
  }
  bulkDeleteProgram(ids: string[]) {
    return this.bulkDelete(this.prisma.program, ids, 'Program');
  }
  async bulkDeleteRole(ids: string[]) {
    // Per-id: deleteRole() punya pengaman (role sistem / masih dipakai user).
    let count = 0;
    for (const id of ids) {
      await this.deleteRole(id);
      count++;
    }
    return { message: `${count} role berhasil dihapus`, count };
  }

  // ========== READ ==========
  getBalai() {
    return this.prisma.balai.findMany({ orderBy: { name: 'asc' } });
  }
  getPeriodes() {
    return this.prisma.periode.findMany({ orderBy: { startYear: 'desc' } });
  }
  getPrograms() {
    return this.prisma.program.findMany({ orderBy: { name: 'asc' } });
  }
  getKegiatan() {
    return this.prisma.kegiatan.findMany({
      include: {
        program: true,
        // dipakai frontend buat nentuin tab evaluasi tampil atau tidak
        // (kegiatan punya evaluasi kalau sudah punya FormTemplate).
        formTemplate: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
  getKRO() {
    return this.prisma.kRO.findMany({
      include: { kegiatan: { include: { program: true } } },
      orderBy: { name: 'asc' },
    });
  }
  getRO() {
    return this.prisma.rO.findMany({
      include: {
        indikatorRO: true,
        kro: { include: { kegiatan: { include: { program: true } } } },
        satuan: true,
        provinsi: true,
      },
      orderBy: { name: 'asc' },
    });
  }
  getKomponen() {
    return this.prisma.komponen.findMany({
      include: { ro: true, satuan: true },
      orderBy: { name: 'asc' },
    });
  }
  getIndikatorRO() {
    return this.prisma.indikatorRO.findMany({
      include: { ro: true, satuanList: { include: { satuan: true } } },
      orderBy: { nama: 'asc' },
    });
  }

  // ========== SATUAN (dropdown creatable) ==========
  getSatuan() {
    return this.prisma.satuan.findMany({ orderBy: { name: 'asc' } });
  }
  /** Upsert by name supaya combobox creatable idempoten (dua user ketik nama sama tidak error). */
  createSatuan(dto: { name: string }) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Nama satuan wajib diisi');
    return this.prisma.satuan.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  // ========== FORM PROYEK (kanvas Master Data, per Kegiatan) ==========
  private readonly formTemplateInclude = {
    tabs: {
      orderBy: { order: 'asc' as const },
      include: {
        sections: {
          orderBy: { order: 'asc' as const },
          include: {
            items: {
              orderBy: { order: 'asc' as const },
              include: { options: { orderBy: { order: 'asc' as const } } },
            },
          },
        },
      },
    },
  };

  /** Tree lengkap template 1 kegiatan. Dibuat otomatis kalau belum ada
   * supaya kanvas Master Data selalu punya sesuatu untuk diedit. Dengan
   * activeOnly=true, tab/section/item/opsi yang nonaktif dibuang — ini yang
   * dipakai form Proyek untuk merender dirinya. */
  async getFormTemplate(kegiatanId: string, activeOnly = false) {
    let template = await this.prisma.formTemplate.findUnique({
      where: { kegiatanId },
      include: this.formTemplateInclude,
    });
    if (!template) {
      template = await this.prisma.formTemplate.create({
        data: { kegiatanId },
        include: this.formTemplateInclude,
      });
    }
    if (!activeOnly) return template;

    return {
      ...template,
      tabs: template.tabs
        .filter((t) => t.isActive)
        .map((t) => ({
          ...t,
          sections: t.sections
            .filter((s) => s.isActive)
            .map((s) => ({
              ...s,
              items: s.items
                .filter((i) => i.isActive)
                .map((i) => ({
                  ...i,
                  options: i.options.filter((o) => o.isActive),
                })),
            })),
        })),
    };
  }

  updateFormTab(id: string, dto: any) {
    return this.prisma.formTab.update({
      where: { id },
      data: {
        label: dto.label,
        isActive: dto.isActive,
        bobot: dto.bobot,
        order: dto.order,
        description: dto.description,
      },
    });
  }

  createFormSection(dto: any) {
    return this.prisma.formSection.create({
      data: {
        tabId: dto.tabId,
        key: dto.key,
        label: dto.label,
        order: dto.order ?? 0,
      },
    });
  }
  updateFormSection(id: string, dto: any) {
    return this.prisma.formSection.update({
      where: { id },
      data: {
        label: dto.label,
        isActive: dto.isActive,
        order: dto.order,
      },
    });
  }
  async deleteFormSection(id: string) {
    await this.prisma.formSection.delete({ where: { id } });
    return { message: 'Section dihapus' };
  }

  createFormItem(dto: any) {
    return this.prisma.formItem.create({
      data: {
        sectionId: dto.sectionId,
        key: dto.key,
        label: dto.label,
        fieldType: dto.fieldType,
        order: dto.order ?? 0,
        required: dto.required ?? false,
        score: dto.score,
        bobot: dto.bobot,
        thresholdValue: dto.thresholdValue,
        conditionItemId: dto.conditionItemId,
        conditionValue: dto.conditionValue,
        width: dto.width,
      },
    });
  }
  updateFormItem(id: string, dto: any) {
    return this.prisma.formItem.update({
      where: { id },
      data: {
        label: dto.label,
        fieldType: dto.fieldType,
        isActive: dto.isActive,
        required: dto.required,
        order: dto.order,
        score: dto.score,
        bobot: dto.bobot,
        thresholdValue: dto.thresholdValue,
        conditionItemId: dto.conditionItemId,
        conditionValue: dto.conditionValue,
        width: dto.width,
      },
    });
  }
  async deleteFormItem(id: string) {
    await this.prisma.formItem.delete({ where: { id } });
    return { message: 'Item dihapus' };
  }

  createFormItemOption(dto: any) {
    return this.prisma.formItemOption.create({
      data: {
        itemId: dto.itemId,
        value: dto.value,
        label: dto.label,
        order: dto.order ?? 0,
        score: dto.score,
        bobot: dto.bobot,
      },
    });
  }
  updateFormItemOption(id: string, dto: any) {
    return this.prisma.formItemOption.update({
      where: { id },
      data: {
        value: dto.value,
        label: dto.label,
        isActive: dto.isActive,
        order: dto.order,
        score: dto.score,
        bobot: dto.bobot,
      },
    });
  }
  async deleteFormItemOption(id: string) {
    await this.prisma.formItemOption.delete({ where: { id } });
    return { message: 'Opsi dihapus' };
  }

  /** Duplikat seluruh tab/section/item/opsi kegiatan sumber ke kegiatan
   * target — dipakai admin supaya tidak mengisi kerangka dari nol tiap
   * kegiatan baru (isi/skor/bobot tetap bisa disesuaikan lagi sesudahnya).
   * Menimpa template kegiatan target kalau sudah ada. */
  async cloneFormTemplate(kegiatanId: string, sourceKegiatanId: string) {
    const source = await this.prisma.formTemplate.findUnique({
      where: { kegiatanId: sourceKegiatanId },
      include: this.formTemplateInclude,
    });
    if (!source) {
      throw new BadRequestException('Template kegiatan sumber belum ada');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.formTemplate.deleteMany({ where: { kegiatanId } });
      return tx.formTemplate.create({
        data: {
          kegiatanId,
          tabs: {
            create: source.tabs.map((t) => ({
              key: t.key,
              label: t.label,
              order: t.order,
              isActive: t.isActive,
              bobot: t.bobot,
              sections: {
                create: t.sections.map((s) => ({
                  key: s.key,
                  label: s.label,
                  order: s.order,
                  isActive: s.isActive,
                  items: {
                    create: s.items.map((i) => ({
                      key: i.key,
                      label: i.label,
                      fieldType: i.fieldType,
                      order: i.order,
                      isActive: i.isActive,
                      required: i.required,
                      score: i.score,
                      bobot: i.bobot,
                      thresholdValue: i.thresholdValue,
                      conditionItemId: i.conditionItemId,
                      conditionValue: i.conditionValue,
                      options: {
                        create: i.options.map((o) => ({
                          value: o.value,
                          label: o.label,
                          order: o.order,
                          isActive: o.isActive,
                          score: o.score,
                          bobot: o.bobot,
                        })),
                      },
                    })),
                  },
                })),
              },
            })),
          },
        },
        include: this.formTemplateInclude,
      });
    });
  }
  // Indikator RENJA (lihat docs-planning/fitur-paket/04-rekonsiliasi-referensi.md)
  getPrioritasNasional() {
    return this.prisma.prioritasNasional.findMany({
      include: {
        programPrioritas: { include: { kegiatanPrioritas: true } },
      },
      orderBy: { code: 'asc' },
    });
  }
  getProgramPrioritas() {
    return this.prisma.programPrioritas.findMany({
      include: { prioritasNasional: true },
      orderBy: { code: 'asc' },
    });
  }
  getKegiatanPrioritas() {
    return this.prisma.kegiatanPrioritas.findMany({
      include: {
        programPrioritas: { include: { prioritasNasional: true } },
      },
      orderBy: { code: 'asc' },
    });
  }
  getPkpn() {
    return this.prisma.pkpn.findMany({ orderBy: { name: 'asc' } });
  }
  getTematikRenja() {
    return this.prisma.tematikRenja.findMany({ orderBy: { name: 'asc' } });
  }
  getSumberUsulanProyek() {
    return this.prisma.sumberUsulanProyek.findMany({
      orderBy: { name: 'asc' },
    });
  }
  getTaggingDinamis() {
    return this.prisma.taggingDinamis.findMany({ orderBy: { name: 'asc' } });
  }
  getSasaranProgram() {
    return this.prisma.sasaranProgram.findMany({
      include: { program: true, indikator: true },
    });
  }
  getSasaranKegiatan() {
    return this.prisma.sasaranKegiatan.findMany({
      include: { kegiatan: true, indikator: true },
    });
  }

  getWilayahSungai() {
    return this.prisma.wilayahSungai.findMany({ orderBy: { name: 'asc' } });
  }
  getRoles() {
    return this.prisma.role.findMany({
      include: { kegiatan: { select: { id: true, code: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }
  /**
   * Role bawaan sistem: kode & keberadaannya dipakai langsung di kode
   * (RolesGuard, filter kegiatan, halaman log aktivitas), jadi tidak boleh
   * dihapus atau diikat ke satu kegiatan lewat UI.
   */
  private readonly ROLE_SISTEM = ['SUPER_ADMIN', 'ADMINISTRATOR'];

  /** Buat role baru dari UI. Kode dinormalkan jadi HURUF_BESAR karena
   * dipakai apa adanya di @Roles() dan pengecekan role di frontend. */
  async createRole(dto: {
    code: string;
    name: string;
    kegiatanId?: string;
    baseRole?: string;
  }) {
    const code = String(dto.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    if (!code) throw new BadRequestException('Kode role wajib diisi');
    if (!dto.name?.trim())
      throw new BadRequestException('Nama role wajib diisi');

    const duplikat = await this.prisma.role.findUnique({ where: { code } });
    if (duplikat)
      throw new BadRequestException(`Role dengan kode "${code}" sudah ada`);

    // Tanpa baseRole, role baru ditolak semua endpoint karena kodenya tidak
    // ada di dekorator @Roles() mana pun — jadi wajib diisi, bukan opsional.
    if (!dto.baseRole || !BASE_ROLES.includes(dto.baseRole))
      throw new BadRequestException(
        `Template izin wajib dipilih: ${BASE_ROLES.join(', ')}`,
      );

    return this.prisma.role.create({
      data: {
        code,
        name: dto.name.trim(),
        kegiatanId: dto.kegiatanId || null,
        baseRole: dto.baseRole,
      },
      include: { kegiatan: true },
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    if (this.ROLE_SISTEM.includes(role.code))
      throw new BadRequestException(
        `Role "${role.code}" dipakai sistem dan tidak bisa dihapus`,
      );
    // Kalau tetap dihapus, user-nya jadi tanpa role dan kehilangan seluruh
    // akses tanpa jejak — lebih baik ditolak dengan pesan yang jelas.
    if (role._count.users > 0)
      throw new BadRequestException(
        `Role masih dipakai ${role._count.users} pengguna — pindahkan dulu penggunanya`,
      );

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role berhasil dihapus' };
  }

  /** Ganti nama / cakupan kegiatan sebuah role. SUPER_ADMIN & ADMINISTRATOR
   * memang lintas kegiatan, jadi kegiatanId-nya dipaksa null. */
  async updateRole(
    id: string,
    dto: { kegiatanId?: string | null; name?: string; baseRole?: string },
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    // Dipaksa di server, bukan cuma di-disable di UI: dua role ini memang
    // lintas kegiatan, mengikatnya ke satu kegiatan akan mengunci admin
    // dari proyek kegiatan lain.
    const lintasKegiatan = this.ROLE_SISTEM.includes(role.code);
    if (dto.baseRole !== undefined && !BASE_ROLES.includes(dto.baseRole))
      throw new BadRequestException(
        `Template izin tidak dikenal: ${dto.baseRole}`,
      );
    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        kegiatanId: lintasKegiatan ? null : dto.kegiatanId || null,
        baseRole: dto.baseRole,
      },
      include: { kegiatan: true },
    });
  }

  // ========== BALAI ==========
  createBalai(dto: any) {
    return this.prisma.balai.create({ data: dto });
  }
  updateBalai(id: number, dto: any) {
    return this.prisma.balai.update({ where: { id }, data: dto });
  }
  async deleteBalai(id: number) {
    await this.prisma.balai.delete({ where: { id } });
    return { message: 'Balai berhasil dihapus' };
  }

  // ========== PERIODE ==========
  createPeriode(dto: any) {
    return this.prisma.periode.create({ data: dto });
  }
  updatePeriode(id: number, dto: any) {
    return this.prisma.periode.update({ where: { id }, data: dto });
  }
  async deletePeriode(id: number) {
    await this.prisma.periode.delete({ where: { id } });
    return { message: 'Periode berhasil dihapus' };
  }

  // ========== PROGRAM ==========
  createProgram(dto: any) {
    return this.prisma.program.create({ data: dto });
  }
  updateProgram(id: string, dto: any) {
    return this.prisma.program.update({ where: { id }, data: dto });
  }
  async deleteProgram(id: string) {
    await this.prisma.program.delete({ where: { id } });
    return { message: 'Program berhasil dihapus' };
  }

  // ========== KEGIATAN ==========
  createKegiatan(dto: any) {
    return this.prisma.kegiatan.create({ data: dto });
  }
  updateKegiatan(id: string, dto: any) {
    return this.prisma.kegiatan.update({ where: { id }, data: dto });
  }
  async deleteKegiatan(id: string) {
    await this.prisma.kegiatan.delete({ where: { id } });
    return { message: 'Kegiatan berhasil dihapus' };
  }
  async bulkDeleteKegiatan(ids: string[]) {
    const result = await this.prisma.kegiatan.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} Kegiatan berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== KRO ==========
  createKRO(dto: any) {
    return this.prisma.kRO.create({ data: dto });
  }
  updateKRO(id: string, dto: any) {
    return this.prisma.kRO.update({ where: { id }, data: dto });
  }
  async deleteKRO(id: string) {
    await this.prisma.kRO.delete({ where: { id } });
    return { message: 'KRO berhasil dihapus' };
  }
  async bulkDeleteKRO(ids: string[]) {
    const result = await this.prisma.kRO.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} KRO berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== RO ==========
  /** provinceIds dikirim terpisah dari field RO biasa — di-replace-all ke RoProvinsi. */
  private async syncRoProvinsi(roId: string, provinceIds?: string[]) {
    if (!provinceIds) return;
    await this.prisma.roProvinsi.deleteMany({ where: { roId } });
    if (provinceIds.length === 0) return;
    const provinces = await this.prisma.wilayahProvince.findMany({
      where: { id: { in: provinceIds } },
    });
    await this.prisma.roProvinsi.createMany({
      data: provinces.map((p) => ({
        roId,
        provinceId: p.id,
        provinceName: p.name,
      })),
    });
  }
  async createRO(dto: any) {
    const { provinceIds, ...data } = dto;
    const ro = await this.prisma.rO.create({ data });
    await this.syncRoProvinsi(ro.id, provinceIds);
    return ro;
  }
  async updateRO(id: string, dto: any) {
    const { provinceIds, ...data } = dto;
    const ro = await this.prisma.rO.update({ where: { id }, data });
    await this.syncRoProvinsi(id, provinceIds);
    return ro;
  }
  async deleteRO(id: string) {
    await this.prisma.rO.delete({ where: { id } });
    return { message: 'RO berhasil dihapus' };
  }
  async bulkDeleteRO(ids: string[]) {
    const result = await this.prisma.rO.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} RO berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== KOMPONEN ==========
  createKomponen(dto: any) {
    return this.prisma.komponen.create({ data: dto });
  }
  /** satuanIds dikirim terpisah — di-replace-all ke IndikatorRoSatuan. */
  private async syncIndikatorRoSatuan(
    indikatorRoId: string,
    satuanIds?: string[],
  ) {
    if (!satuanIds) return;
    await this.prisma.indikatorRoSatuan.deleteMany({
      where: { indikatorRoId },
    });
    if (satuanIds.length === 0) return;
    await this.prisma.indikatorRoSatuan.createMany({
      data: satuanIds.map((satuanId) => ({ indikatorRoId, satuanId })),
    });
  }
  async createIndikatorRO(dto: any) {
    const { satuanIds, ...data } = dto;
    const iro = await this.prisma.indikatorRO.create({ data });
    await this.syncIndikatorRoSatuan(iro.id, satuanIds);
    return iro;
  }
  async updateIndikatorRO(id: string, dto: any) {
    const { satuanIds, ...data } = dto;
    const iro = await this.prisma.indikatorRO.update({ where: { id }, data });
    await this.syncIndikatorRoSatuan(id, satuanIds);
    return iro;
  }
  async deleteIndikatorRO(id: string) {
    await this.prisma.indikatorRO.delete({ where: { id } });
    return { message: 'Indikator RO berhasil dihapus' };
  }
  updateKomponen(id: string, dto: any) {
    return this.prisma.komponen.update({ where: { id }, data: dto });
  }
  async deleteKomponen(id: string) {
    await this.prisma.komponen.delete({ where: { id } });
    return { message: 'Komponen berhasil dihapus' };
  }
  async bulkDeleteKomponen(ids: string[]) {
    const result = await this.prisma.komponen.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} Komponen berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== PRIORITAS NASIONAL (PN) ==========
  createPrioritasNasional(dto: any) {
    return this.prisma.prioritasNasional.create({ data: dto });
  }
  updatePrioritasNasional(id: string, dto: any) {
    return this.prisma.prioritasNasional.update({ where: { id }, data: dto });
  }
  async deletePrioritasNasional(id: string) {
    await this.prisma.prioritasNasional.delete({ where: { id } });
    return { message: 'Prioritas Nasional berhasil dihapus' };
  }

  // ========== PROGRAM PRIORITAS (PP) ==========
  createProgramPrioritas(dto: any) {
    return this.prisma.programPrioritas.create({ data: dto });
  }
  updateProgramPrioritas(id: string, dto: any) {
    return this.prisma.programPrioritas.update({ where: { id }, data: dto });
  }
  async deleteProgramPrioritas(id: string) {
    await this.prisma.programPrioritas.delete({ where: { id } });
    return { message: 'Program Prioritas berhasil dihapus' };
  }

  // ========== KEGIATAN PRIORITAS (KP) ==========
  createKegiatanPrioritas(dto: any) {
    return this.prisma.kegiatanPrioritas.create({ data: dto });
  }
  updateKegiatanPrioritas(id: string, dto: any) {
    return this.prisma.kegiatanPrioritas.update({ where: { id }, data: dto });
  }
  async deleteKegiatanPrioritas(id: string) {
    await this.prisma.kegiatanPrioritas.delete({ where: { id } });
    return { message: 'Kegiatan Prioritas berhasil dihapus' };
  }

  // ========== PKPN ==========
  createPkpn(dto: any) {
    return this.prisma.pkpn.create({ data: dto });
  }
  updatePkpn(id: string, dto: any) {
    return this.prisma.pkpn.update({ where: { id }, data: dto });
  }
  async deletePkpn(id: string) {
    await this.prisma.pkpn.delete({ where: { id } });
    return { message: 'PKPN berhasil dihapus' };
  }

  // ========== TEMATIK RENJA ==========
  createTematikRenja(dto: any) {
    return this.prisma.tematikRenja.create({ data: dto });
  }
  updateTematikRenja(id: string, dto: any) {
    return this.prisma.tematikRenja.update({ where: { id }, data: dto });
  }
  async deleteTematikRenja(id: string) {
    await this.prisma.tematikRenja.delete({ where: { id } });
    return { message: 'Tematik RENJA berhasil dihapus' };
  }

  // ========== SUMBER USULAN PROYEK ==========
  createSumberUsulanProyek(dto: any) {
    return this.prisma.sumberUsulanProyek.create({ data: dto });
  }
  updateSumberUsulanProyek(id: string, dto: any) {
    return this.prisma.sumberUsulanProyek.update({ where: { id }, data: dto });
  }
  async deleteSumberUsulanProyek(id: string) {
    await this.prisma.sumberUsulanProyek.delete({ where: { id } });
    return { message: 'Sumber Usulan Proyek berhasil dihapus' };
  }

  // ========== TAGGING DINAMIS ==========
  createTaggingDinamis(dto: any) {
    return this.prisma.taggingDinamis.create({ data: dto });
  }
  updateTaggingDinamis(id: string, dto: any) {
    return this.prisma.taggingDinamis.update({ where: { id }, data: dto });
  }
  async deleteTaggingDinamis(id: string) {
    await this.prisma.taggingDinamis.delete({ where: { id } });
    return { message: 'Tagging Dinamis berhasil dihapus' };
  }

  // ========== SASARAN PROGRAM (SP) & INDIKATORNYA (ISP) ==========
  createSasaranProgram(dto: any) {
    return this.prisma.sasaranProgram.create({ data: dto });
  }
  updateSasaranProgram(id: string, dto: any) {
    return this.prisma.sasaranProgram.update({ where: { id }, data: dto });
  }
  async deleteSasaranProgram(id: string) {
    await this.prisma.sasaranProgram.delete({ where: { id } });
    return { message: 'Sasaran Program berhasil dihapus' };
  }
  createIndikatorSasaranProgram(dto: any) {
    return this.prisma.indikatorSasaranProgram.create({ data: dto });
  }
  updateIndikatorSasaranProgram(id: string, dto: any) {
    return this.prisma.indikatorSasaranProgram.update({
      where: { id },
      data: dto,
    });
  }
  async deleteIndikatorSasaranProgram(id: string) {
    await this.prisma.indikatorSasaranProgram.delete({ where: { id } });
    return { message: 'Indikator Sasaran Program berhasil dihapus' };
  }

  // ========== SASARAN KEGIATAN (SK) & INDIKATORNYA (ISK) ==========
  createSasaranKegiatan(dto: any) {
    return this.prisma.sasaranKegiatan.create({ data: dto });
  }
  updateSasaranKegiatan(id: string, dto: any) {
    return this.prisma.sasaranKegiatan.update({ where: { id }, data: dto });
  }
  async deleteSasaranKegiatan(id: string) {
    await this.prisma.sasaranKegiatan.delete({ where: { id } });
    return { message: 'Sasaran Kegiatan berhasil dihapus' };
  }
  createIndikatorSasaranKegiatan(dto: any) {
    return this.prisma.indikatorSasaranKegiatan.create({ data: dto });
  }
  updateIndikatorSasaranKegiatan(id: string, dto: any) {
    return this.prisma.indikatorSasaranKegiatan.update({
      where: { id },
      data: dto,
    });
  }
  async deleteIndikatorSasaranKegiatan(id: string) {
    await this.prisma.indikatorSasaranKegiatan.delete({ where: { id } });
    return { message: 'Indikator Sasaran Kegiatan berhasil dihapus' };
  }

  // ========== WILAYAH SUNGAI ==========
  createWilayahSungai(dto: any) {
    return this.prisma.wilayahSungai.create({ data: dto });
  }
  updateWilayahSungai(id: string, dto: any) {
    return this.prisma.wilayahSungai.update({ where: { id }, data: dto });
  }
  async deleteWilayahSungai(id: string) {
    await this.prisma.wilayahSungai.delete({ where: { id } });
    return { message: 'Wilayah Sungai berhasil dihapus' };
  }
}
