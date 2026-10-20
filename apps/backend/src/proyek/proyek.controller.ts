import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProyekService } from './proyek.service';
import { CreateProyekDto } from './dto/create-proyek.dto';
import { UpdateProyekDto } from './dto/update-proyek.dto';
import { QueryProyekDto } from './dto/query-proyek.dto';
import { PreviewSkorDto } from './dto/preview-skor.dto';
import { IdsDto, PeriksaDto, PutuskanDto, QueryPemeriksaanDto } from './dto/pemeriksaan.dto';

@ApiTags('Proyek')
@ApiBearerAuth()
@Controller('proyek')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProyekController {
  constructor(private readonly proyekService: ProyekService) {}

  @ApiOperation({ summary: 'Buat proyek baru' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post()
  create(@Body() dto: CreateProyekDto, @CurrentUser() user: any) {
    return this.proyekService.create(dto, user);
  }

  @ApiOperation({
    summary:
      'Preview skor evaluasi (tanpa menyimpan) — dipakai form untuk live update',
  })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post('preview-skor')
  previewSkor(@Body() dto: PreviewSkorDto) {
    return this.proyekService.previewEvaluasi(dto);
  }

  @ApiOperation({ summary: 'Daftar proyek dengan pagination & filter' })
  @Roles('SATKER', 'VERIFICATOR', 'OPERATOR', 'ADMINISTRATOR')
  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryProyekDto) {
    return this.proyekService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Ringkasan angka dashboard (semua proyek yang boleh dilihat)' })
  @Roles('SATKER', 'VERIFICATOR', 'OPERATOR', 'ADMINISTRATOR')
  @Get('ringkasan')
  ringkasan(@CurrentUser() user: any) {
    return this.proyekService.ringkasan(user);
  }

  @ApiOperation({ summary: 'Menu Pemeriksaan: daftar per tab + jumlah' })
  @Roles('VERIFICATOR', 'OPERATOR', 'ADMINISTRATOR')
  @Get('pemeriksaan')
  daftarPemeriksaan(@CurrentUser() user: any, @Query() q: QueryPemeriksaanDto) {
    return this.proyekService.daftarPemeriksaan(user, q);
  }

  @ApiOperation({ summary: 'Ajukan banyak proyek sekaligus (Draft/Dikembalikan)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post('ajukan-massal')
  ajukanMassal(@Body() dto: IdsDto, @CurrentUser() user: any) {
    return this.proyekService.massal(dto.ids, user, (id) => this.proyekService.ajukan(id, user));
  }

  @ApiOperation({ summary: 'Setujui banyak proyek sekaligus (Admin)' })
  @Roles('ADMINISTRATOR')
  @Post('setujui-massal')
  setujuiMassal(@Body() dto: IdsDto, @CurrentUser() user: any) {
    return this.proyekService.massal(dto.ids, user, (id) =>
      this.proyekService.putuskan(id, user, { hasil: 'SETUJU' }),
    );
  }

  @ApiOperation({ summary: 'Detail proyek' })
  @ApiParam({ name: 'id' })
  @Roles('SATKER', 'VERIFICATOR', 'OPERATOR', 'ADMINISTRATOR')
  @Get(':id/skor')
  @ApiOperation({ summary: 'Skor evaluasi & rincian per tab proyek tersimpan' })
  skor(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.skor(id, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.findOne(id, user);
  }

  @ApiOperation({ summary: 'Riwayat proyek berlabel (khusus admin)' })
  @Roles('ADMINISTRATOR')
  @Get(':id/riwayat')
  riwayat(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.riwayat(id, user);
  }

  @ApiOperation({ summary: 'Yang berubah sejak pengembalian terakhir (Pemeriksaan)' })
  @Roles('VERIFICATOR', 'OPERATOR', 'ADMINISTRATOR')
  @Get(':id/perubahan')
  perubahan(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.perubahanSejakDikembalikan(id, user);
  }

  @ApiOperation({ summary: 'Jejak pengajuan & pemeriksaan proyek' })
  @Roles('SATKER', 'VERIFICATOR', 'OPERATOR', 'ADMINISTRATOR')
  @Get(':id/pemeriksaan')
  riwayatPemeriksaan(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.riwayatPemeriksaan(id, user);
  }

  @ApiOperation({ summary: 'Ajukan / ajukan ulang proyek (Draft/Dikembalikan → Diajukan)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Patch(':id/ajukan')
  ajukan(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.ajukan(id, user);
  }

  @ApiOperation({ summary: 'Hasil pemeriksaan Verifikator/Operator (Sesuai / Perlu revisi)' })
  @Roles('VERIFICATOR', 'OPERATOR', 'ADMINISTRATOR')
  @Patch(':id/periksa')
  periksa(@Param('id') id: string, @Body() dto: PeriksaDto, @CurrentUser() user: any) {
    return this.proyekService.periksa(id, user, dto);
  }

  @ApiOperation({ summary: 'Keputusan Admin (Setujui / Kembalikan)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/putuskan')
  putuskan(@Param('id') id: string, @Body() dto: PutuskanDto, @CurrentUser() user: any) {
    return this.proyekService.putuskan(id, user, dto);
  }

  @ApiOperation({ summary: 'Edit proyek (Draft/Dikembalikan)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProyekDto,
    @CurrentUser() user: any,
  ) {
    return this.proyekService.update(id, dto, user);
  }

  @ApiOperation({ summary: 'Hapus proyek (hanya DRAFT)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.remove(id, user);
  }

  @ApiOperation({
    summary: 'Upload dokumen pendukung ke proyek (maks 10 file sekaligus)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        formItemId: { type: 'string', nullable: true },
      },
    },
  })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post(':id/dokumen')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const dir = join(
            process.cwd(),
            'uploads',
            'proyek',
            String(req.params.id),
          );
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadDokumen(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
    @Body('formItemId') formItemId?: string,
  ) {
    return this.proyekService.tambahDokumen(
      id,
      files,
      user.userId,
      formItemId || undefined,
    );
  }

  @ApiOperation({ summary: 'Hapus 1 dokumen pendukung' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Delete('dokumen/:docId')
  removeDokumen(@Param('docId') docId: string, @CurrentUser() user: any) {
    return this.proyekService.hapusDokumen(docId, user.userId);
  }
}
