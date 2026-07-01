import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WilayahService } from './wilayah.service';

@ApiTags('Wilayah')
@ApiBearerAuth()
@Controller('wilayah')
@UseGuards(JwtAuthGuard)
export class WilayahController {
  constructor(private readonly wilayahService: WilayahService) {}

  @ApiOperation({ summary: 'Daftar semua provinsi' })
  @Get('provinces')
  getProvinces() {
    return this.wilayahService.getProvinces();
  }

  @ApiOperation({ summary: 'Daftar kota/kabupaten dalam suatu provinsi' })
  @Get('regencies/:provinceId')
  getRegencies(@Param('provinceId') provinceId: string) {
    return this.wilayahService.getRegencies(provinceId);
  }

  @ApiOperation({ summary: 'Daftar kecamatan dalam suatu kota/kabupaten' })
  @Get('districts/:regencyId')
  getDistricts(@Param('regencyId') regencyId: string) {
    return this.wilayahService.getDistricts(regencyId);
  }

  @ApiOperation({ summary: 'Daftar desa/kelurahan dalam suatu kecamatan' })
  @Get('villages/:districtId')
  getVillages(@Param('districtId') districtId: string) {
    return this.wilayahService.getVillages(districtId);
  }
}
