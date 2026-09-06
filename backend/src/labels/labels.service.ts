import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BoardsService } from '../boards/boards.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

/**
 * Palette tokens a label may use.
 *
 * Names, not hex values: DESIGN.md forbids hardcoded colors, and a token lets
 * light and dark mode each resolve their own value. Kept deliberately small —
 * a label palette exists to make labels scannable at a glance, which stops
 * working once there are dozens of near-identical hues.
 */
export const LABEL_COLORS = [
  'slate',
  'rose',
  'amber',
  'emerald',
  'sky',
  'indigo',
  'violet',
  'pink',
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

export interface LabelResponse {
  id: string;
  boardId: string;
  name: string;
  color: string;
  createdAt: string;
}

@Injectable()
export class LabelsService {
  private readonly logger = new Logger(LabelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boards: BoardsService,
  ) {}

  private toResponse(label: {
    id: string;
    boardId: string;
    name: string;
    color: string;
    createdAt: Date;
  }): LabelResponse {
    return {
      id: label.id,
      boardId: label.boardId,
      name: label.name,
      color: label.color,
      createdAt: label.createdAt.toISOString(),
    };
  }

  /** List a board's labels. Caller needs VIEWER+. */
  async listForBoard(userId: string, boardId: string): Promise<LabelResponse[]> {
    await this.boards.assertAccess(userId, boardId, 'VIEWER');
    const labels = await this.prisma.label.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' },
    });
    return labels.map((l) => this.toResponse(l));
  }

  /** Create a label on a board. Caller needs EDITOR+. */
  async create(userId: string, boardId: string, dto: CreateLabelDto): Promise<LabelResponse> {
    await this.boards.assertAccess(userId, boardId, 'EDITOR');

    const name = dto.name.trim();
    if (name.length === 0) {
      throw new BadRequestException('Label name is required');
    }

    try {
      const label = await this.prisma.label.create({
        data: { boardId, name, color: dto.color },
      });
      this.logger.log(`Label ${label.id} (${name}) created on board ${boardId} by ${userId}`);
      return this.toResponse(label);
    } catch (e) {
      // Racing creates of the same name land here rather than on a read-then-write
      // check, which could pass for both callers.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`A label named "${name}" already exists on this board`);
      }
      throw e;
    }
  }

  /** Rename or recolor a label. Caller needs EDITOR+ on the owning board. */
  async update(userId: string, labelId: string, dto: UpdateLabelDto): Promise<LabelResponse> {
    const existing = await this.prisma.label.findUnique({
      where: { id: labelId },
      select: { id: true, boardId: true },
    });
    if (!existing) {
      throw new NotFoundException('Label not found');
    }
    await this.boards.assertAccess(userId, existing.boardId, 'EDITOR');

    const data: { name?: string; color?: string } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length === 0) throw new BadRequestException('Label name is required');
      data.name = name;
    }
    if (dto.color !== undefined) data.color = dto.color;

    try {
      const label = await this.prisma.label.update({ where: { id: labelId }, data });
      return this.toResponse(label);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`A label named "${data.name}" already exists on this board`);
      }
      throw e;
    }
  }

  /**
   * Delete a label. Caller needs EDITOR+ on the owning board.
   * `task_labels` cascades, so the label detaches from every task it was on.
   */
  async remove(userId: string, labelId: string): Promise<void> {
    const existing = await this.prisma.label.findUnique({
      where: { id: labelId },
      select: { id: true, boardId: true },
    });
    if (!existing) {
      throw new NotFoundException('Label not found');
    }
    await this.boards.assertAccess(userId, existing.boardId, 'EDITOR');

    await this.prisma.label.delete({ where: { id: labelId } });
    this.logger.log(`Label ${labelId} deleted from board ${existing.boardId} by ${userId}`);
  }

  /**
   * Assert every id exists on `boardId`, returning them de-duplicated.
   *
   * Rejects the whole request when an id is unknown or belongs to another
   * board, rather than silently dropping it — a label quietly vanishing from a
   * task is worse than a 400 the client can act on. Cross-board ids are the
   * interesting case: they are how a caller would try to read another board's
   * label names.
   */
  async assertLabelsOnBoard(labelIds: string[], boardId: string): Promise<string[]> {
    const unique = [...new Set(labelIds)];
    if (unique.length === 0) return [];

    const found = await this.prisma.label.findMany({
      where: { id: { in: unique }, boardId },
      select: { id: true },
    });

    if (found.length !== unique.length) {
      const known = new Set(found.map((l) => l.id));
      const missing = unique.filter((id) => !known.has(id));
      throw new BadRequestException(
        `These labels do not exist on this board: ${missing.join(', ')}`,
      );
    }
    return unique;
  }
}
