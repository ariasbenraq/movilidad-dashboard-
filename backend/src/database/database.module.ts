import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fileURLToPath } from 'node:url';

const entities = fileURLToPath(
  new URL('../**/*.entity.{ts,js}', import.meta.url),
);
const migrations = fileURLToPath(
  new URL('../migrations/*.{ts,js}', import.meta.url),
);

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.getOrThrow<string>('DB_PORT')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [entities],
        migrations: [migrations],
        synchronize: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
