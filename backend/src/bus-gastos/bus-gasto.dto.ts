import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsFechaForm, amount, trimToNull } from '../ingest/ingest.dto.js';

/** Body of POST and PUT /bus-gastos. */
export class BusGastoDto {
  @IsFechaForm()
  fecha: string;

  @trimToNull()
  @IsString()
  @Length(1, 100)
  desde: string;

  @trimToNull()
  @IsString()
  @Length(1, 100)
  hacia: string;

  @amount()
  @Min(0)
  @Max(500)
  costo: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  duracion_min?: number | null;

  @trimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota?: string | null;
}
