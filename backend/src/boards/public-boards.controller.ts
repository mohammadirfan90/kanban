import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PublicLinksService } from './public-links.service';
import type { PublicBoardView } from './public-board-view';

/*
  The only unauthenticated data path in the API.

  Note what this controller does NOT have: no `@UseGuards(JwtAuthGuard)` —
  intentional, a visitor has no account — and no verb other than GET. There is
  deliberately no POST/PATCH/DELETE to get wrong: "view only" is enforced by
  the absence of any other route on this path, not by a check inside one.

  It also never touches BoardsService.assertAccess, because there is no caller
  to authorize. Holding the slug is the entire authorization, which is why the
  slug is 16 bytes of CSPRNG output and why the service treats revoked and
  unknown slugs identically.
*/
@Controller('public/boards')
export class PublicBoardsController {
  constructor(private readonly links: PublicLinksService) {}

  @Get(':slug')
  // Tighter than the global tier: unauthenticated and enumerable by shape, so
  // it is the one endpoint where a scripted sweep costs us nothing to make
  // expensive.
  @Throttle({ short: { limit: 10, ttl: 1_000 }, default: { limit: 120, ttl: 60_000 } })
  // Keeps a shared board out of search results. A capability URL that Google
  // has indexed is no longer a capability.
  @Header('X-Robots-Tag', 'noindex, nofollow')
  // Revocation has to be immediate; a cached copy would outlive it.
  @Header('Cache-Control', 'no-store')
  async view(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicBoardView> {
    const board = await this.links.viewBySlug(slug);
    // Referrer would carry the slug to any site linked from the board content.
    res.setHeader('Referrer-Policy', 'no-referrer');
    return board;
  }
}
