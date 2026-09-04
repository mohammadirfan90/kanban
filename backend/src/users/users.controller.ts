import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService, type UserLookupResult } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Resolve a single user by email. Used by the share-board flow on the
   * frontend to translate a typed email into the userId that the share
   * endpoint requires.
   *
   * Returns 404 when no user matches; 400 when the email is missing/malformed.
   */
  @Get('lookup')
  async lookup(@Query('email') email: string | undefined): Promise<UserLookupResult> {
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new BadRequestException('email query param is required');
    }
    return this.users.lookupByEmail(email);
  }
}
