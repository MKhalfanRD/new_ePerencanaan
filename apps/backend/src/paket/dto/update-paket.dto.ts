import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePaketDto } from './create-paket.dto';

export class UpdatePaketDto extends PartialType(
  OmitType(CreatePaketDto, ['planningId'] as const),
) {}
