import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from './boards.service';
import {
  PUBLIC_BOARD_INCLUDE,
  toPublicBoardView,
  type PublicBoardRow,
  type PublicBoardView,
} from './public-board-view';

/** What the owner sees when managing the link. */
export interface PublicLinkView {
  slug: string;
  url: string;
  createdAt: string;
}

/**
 * What a non-owner member sees: that the board is exposed, but not the slug.
 *
 * An editor has every right to know the board is readable by the internet —
 * it changes what they should put on it. They do not get the URL, because
 * handing it over would let them reshare the board publicly without the
 * owner's involvement, which is the thing making this owner-only was meant to
 * prevent.
 */
export interface PublicLinkStatus {
  isPublic: boolean;
}

/** 16 bytes -> 22 base64url chars. The slug IS the credential, so it is CSPRNG. */
const SLUG_BYTES = 16;

@Injectable()
export class PublicLinksService {
  private readonly logger = new Logger(PublicLinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boards: BoardsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create the board's public link, or rotate it if one already exists.
   *
   * Rotation revokes the old slug and issues the new one in a single
   * transaction, so there is never a moment where both work and never a moment
   * where neither does. "Rotate" is the honest name for what a second call
   * does — the previous URL stops working immediately, which is the point when
   * a link has been shared somewhere it should not have been.
   */
  async createOrRotate(userId: string, boardId: string): Promise<PublicLinkView> {
    await this.boards.assertAccess(userId, boardId, 'OWNER');

    const slug = randomBytes(SLUG_BYTES).toString('base64url');
    const now = new Date();

    const [, created] = await this.prisma.$transaction([
      this.prisma.boardPublicLink.updateMany({
        where: { boardId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.boardPublicLink.create({
        data: { boardId, slug, createdById: userId },
      }),
    ]);

    this.logger.log(`Board ${boardId} published by ${userId}`);
    return this.toView(created.slug, created.createdAt);
  }

  /**
   * Owners get the slug; other members get only whether the board is public.
   * Non-members get 403 from assertAccess, as everywhere else.
   */
  async get(userId: string, boardId: string): Promise<PublicLinkView | PublicLinkStatus> {
    const role = await this.boards.assertAccess(userId, boardId, 'VIEWER');
    const link = await this.prisma.boardPublicLink.findFirst({
      where: { boardId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (role !== 'OWNER') {
      return { isPublic: link !== null };
    }
    return link ? this.toView(link.slug, link.createdAt) : { isPublic: false };
  }

  async revoke(userId: string, boardId: string): Promise<void> {
    await this.boards.assertAccess(userId, boardId, 'OWNER');
    const { count } = await this.prisma.boardPublicLink.updateMany({
      where: { boardId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('This board has no public link');
    }
    this.logger.log(`Board ${boardId} unpublished by ${userId}`);
  }

  /**
   * Resolve a slug to a board for an anonymous visitor.
   *
   * A revoked slug and a slug that never existed both raise the same
   * NotFoundException. Distinguishing them would confirm that a given URL was
   * once live, which is information an anonymous caller has no business
   * having.
   */
  async viewBySlug(slug: string): Promise<PublicBoardView> {
    const link = await this.prisma.boardPublicLink.findUnique({
      where: { slug },
      select: { boardId: true, revokedAt: true },
    });

    if (!link || link.revokedAt) {
      throw new NotFoundException('This link is not available');
    }

    const board = await this.prisma.board.findUnique({
      where: { id: link.boardId },
      include: PUBLIC_BOARD_INCLUDE,
    });

    if (!board) {
      throw new NotFoundException('This link is not available');
    }

    return toPublicBoardView(board as PublicBoardRow);
  }

  /** Used by the board response so every member can see the public badge. */
  async isPublic(boardId: string): Promise<boolean> {
    const link = await this.prisma.boardPublicLink.findFirst({
      where: { boardId, revokedAt: null },
      select: { id: true },
    });
    return link !== null;
  }

  private toView(slug: string, createdAt: Date): PublicLinkView {
    const base = (this.config.get<string>('PUBLIC_APP_URL') ?? '').replace(/\/+$/, '');
    return {
      slug,
      // Relative when no base is configured, so a self-hosted deployment does
      // not advertise somebody else's hostname.
      url: base ? `${base}/b/${slug}` : `/b/${slug}`,
      createdAt: createdAt.toISOString(),
    };
  }
}
