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
    return this.proyekService.create(dto, user.userId, user.role);
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
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryProyekDto) {
    return this.proyekService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Detail proyek' })
  @ApiParam({ name: 'id' })
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.findOne(id, user);
  }

  @ApiOperation({ summary: 'Setujui proyek (DRAFT → APPROVED)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.proyekService.approve(id);
  }

  @ApiOperation({ summary: 'Kembalikan proyek ke draft (APPROVED → DRAFT)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/unapprove')
  unapprove(@Param('id') id: string) {
    return this.proyekService.unapprove(id);
  }

  @ApiOperation({ summary: 'Edit proyek (hanya DRAFT)' })
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
  removeDokumen(@Param('docId') docId: string) {
    return this.proyekService.hapusDokumen(docId);
  }
}
