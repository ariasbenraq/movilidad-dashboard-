import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const provided = request.headers['x-api-key'];
    const expected = this.config.getOrThrow<string>('INGEST_API_KEY');

    // Comparing digests keeps the comparison constant-time regardless of length.
    if (
      typeof provided !== 'string' ||
      !timingSafeEqual(digest(provided), digest(expected))
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
