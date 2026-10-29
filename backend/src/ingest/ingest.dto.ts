import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';
import { isValidFechaForm } from './ingest.rules.js';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Trim strings; an empty string becomes null. */
const trimToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

function IsFechaForm(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isFechaForm',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidFechaForm(value),
        defaultMessage: () =>
          'fecha_form must be a valid date (YYYY-MM-DD) between 2020-01-01 and tomorrow',
      },
    },
    options,
  );
}

function IsIsoWithOffset(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isIsoWithOffset',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          ISO_WITH_OFFSET.test(value) &&
          !Number.isNaN(Date.parse(value)),
        defaultMessage: () =>
          'received_at must be an ISO 8601 date-time with a UTC offset',
      },
    },
    options,
  );
}

const amount = () =>
  IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: '$property must be a number with at most 2 decimals' },
  );

export class IngestDto {
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'gmail_message_id may only contain letters, digits, _ and -',
  })
  gmail_message_id: string;

  @IsIsoWithOffset()
  received_at: string;

  @IsFechaForm()
  fecha_form: string;

  @IsOptional()
  @amount()
  @Min(0)
  @Max(5000)
  costo_movilidad?: number | null;

  @IsOptional()
  @amount()
  @Min(0)
  @Max(5000)
  otros_gastos?: number | null;

  @trimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  otros_detalle?: string | null;

  @trimToNull()
  @IsOptional()
  @Matches(HHMM, { message: '$property must be HH:MM (24 hours)' })
  he_inicio?: string | null;

  @trimToNull()
  @IsOptional()
  @Matches(HHMM, { message: '$property must be HH:MM (24 hours)' })
  he_fin?: string | null;

  @trimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workorder?: string | null;

  @trimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cliente?: string | null;

  @trimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipo_traslado?: string | null;

  @IsString()
  @Length(1, 20)
  parser_version: string;
}
