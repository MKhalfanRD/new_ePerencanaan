import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
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

  @ApiOperation({
    summary: 'Cari lokasi berdasarkan nama tempat/alamat (forward geocode)',
  })
  @ApiQuery({ name: 'q', example: 'Bendung Katulampa' })
  @Get('search')
  searchAddress(@Query('q') q: string) {
    if (!q || !q.trim()) {
      throw new BadRequestException('Parameter q wajib diisi');
    }
    return this.wilayahService.searchAddress(q);
  }

  @ApiOperation({
    summary:
      'Reverse geocode: cari provinsi/kota/kecamatan/desa dari titik koordinat',
  })
  @ApiQuery({ name: 'lat', example: -6.2088 })
  @ApiQuery({ name: 'lng', example: 106.8456 })
  @Get('reverse')
  reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      throw new BadRequestException('Parameter lat dan lng wajib berupa angka');
    }
    return this.wilayahService.reverseGeocode(latNum, lngNum);
  }
}
