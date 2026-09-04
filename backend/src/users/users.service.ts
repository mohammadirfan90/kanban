import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserLookupResult {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a single user by email (case-insensitive). Returns the minimal
   * public profile (id/email/name). 404 if no match — used by the share flow
   * to translate a typed email into the userId that share endpoints require.
   */
  async lookupByEmail(email: string): Promise<UserLookupResult> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
