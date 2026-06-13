import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, SetUserStatusDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Daftar semua user (ADMINISTRATOR)' })
  @Roles('ADMINISTRATOR')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @ApiOperation({ summary: 'Detail user berdasarkan ID (ADMINISTRATOR)' })
  @ApiParam({ name: 'id', description: 'ID user' })
  @Roles('ADMINISTRATOR')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Buat user baru (ADMINISTRATOR)' })
  @Roles('ADMINISTRATOR')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @ApiOperation({ summary: 'Edit data user (ADMINISTRATOR)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Aktifkan / nonaktifkan user (ADMINISTRATOR)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto) {
    return this.usersService.setStatus(id, dto);
  }

  @ApiOperation({ summary: 'Hapus user (ADMINISTRATOR)' })
  @Roles('ADMINISTRATOR')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user.userId);
  }
}
