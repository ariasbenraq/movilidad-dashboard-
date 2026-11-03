import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';

export interface SessionUser {
  username: string;
}

interface UserRow {
  username: string;
  password_hash: string;
}

@Injectable()
export class AuthService {
  // Verified when the user does not exist, so both failures cost the same time.
  private dummyHash?: Promise<string>;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) {}

  /** Returns a signed session token, or throws the same 401 for any failure. */
  async login(username: string, password: string): Promise<string> {
    const rows: UserRow[] = await this.dataSource.query(
      `SELECT username, password_hash FROM users WHERE username = $1`,
      [username],
    );
    const user = rows.at(0);
    const hash = user?.password_hash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, password).catch(() => false);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.jwt.signAsync({ username: user.username });
  }

  /** The session user, or null for a missing, forged or expired token. */
  async verify(token: string): Promise<SessionUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ username?: unknown }>(
        token,
        { algorithms: ['HS256'] },
      );
      return typeof payload.username === 'string'
        ? { username: payload.username }
        : null;
    } catch {
      return null;
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash('dummy-password-for-timing');
    return this.dummyHash;
  }
}
