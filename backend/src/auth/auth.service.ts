import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export const BCRYPT_COST = 12;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  access_token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Deliberately use the same error message for both cases (avoid user enumeration).
    if (!user) {
      // Still hash a dummy password to keep timing similar.
      await bcrypt.compare(dto.password, '$2b$12$invalidsaltinvalidsaltinvalidsaltinvalidsalti');
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResult(user);
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  private buildAuthResult(user: { id: string; email: string; name: string }): AuthResult {
    const payload = { sub: user.id, email: user.email };
    const access_token = this.jwt.sign(payload);

    this.logger.log(`Issued token for ${user.email}`);

    return {
      access_token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}