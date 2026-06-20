import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { CommitImportDto } from './dto/import.dto';

@ApiTags('Import')
@ApiBearerAuth()
@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @ApiOperation({ summary: 'Preview hasil parsing Excel & cek mapping balai' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Roles('ADMINISTRATOR', 'SATKER')
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File Excel wajib diupload');
    return this.importService.preview(file.buffer);
  }

  @ApiOperation({
    summary: 'Commit hasil import setelah resolusi balai selesai',
  })
  @Roles('ADMINISTRATOR', 'SATKER')
  @Post('commit')
  async commit(@Body() dto: CommitImportDto, @CurrentUser() user: any) {
    return this.importService.commit(dto, user.userId);
  }
}
