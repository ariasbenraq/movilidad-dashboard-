import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PERIODO_RE } from '../periodo/periodo.rules.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class RegistrosQueryDto {
  @IsOptional()
  @Matches(PERIODO_RE, { message: 'periodo must be YYYY-MM' })
  periodo?: string;

  @IsOptional()
  @Matches(DATE, { message: 'desde must be YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(DATE, { message: 'hasta must be YYYY-MM-DD' })
  hasta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cliente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  workorder?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  por_revisar?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
