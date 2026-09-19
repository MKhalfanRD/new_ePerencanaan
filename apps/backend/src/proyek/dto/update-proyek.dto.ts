import { PartialType } from '@nestjs/swagger';
import { CreateProyekDto } from './create-proyek.dto';

export class UpdateProyekDto extends PartialType(CreateProyekDto) {}
