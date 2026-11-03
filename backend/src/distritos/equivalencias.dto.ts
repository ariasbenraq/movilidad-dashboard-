import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class UpsertEquivalenciaDto {
  @trim()
  @IsString()
  @Length(1, 100)
  texto: string;

  @trim()
  @IsString()
  @Length(1, 100)
  distrito: string;
}
