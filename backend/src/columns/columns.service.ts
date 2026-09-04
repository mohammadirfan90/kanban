import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Column, Task } from '@prisma/client';
import { BoardsService } from '../boards/boards.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  position: number;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnResponse {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  tasks: TaskView[];
}

/** Default gap between consecutive columns when reordering. Leaves headroom for fractional inserts. */
const COLUMN_POSITION_STEP = 1024;

@Injectable()
export class ColumnsService {
  private readonly logger = new Logger(ColumnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boards: BoardsService,
  ) {}

  /**
   * Default include for column responses: tasks ordered by fractional position.
   * Prevents N+1 when a board returns its columns + their tasks.
   */
  private defaultInclude() {
    return {
      tasks: {
        orderBy: { position: 'asc' as const },
      },
    };
  }

  private toColumnResponse(column: Column & { tasks: Task[] }): ColumnResponse {
    return {
      id: column.id,
      boardId: column.boardId,
      title: column.title,
      position: column.position,
      createdAt: column.createdAt.toISOString(),
      updatedAt: column.updatedAt.toISOString(),
      tasks: column.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        position: t.position,
        assigneeId: t.assigneeId,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Create a column on a board. Caller must have EDITOR+ access.
   * If `dto.position` is omitted, append after the highest existing position.
   */
  async create(userId: string, dto: CreateColumnDto): Promise<ColumnResponse> {
    await this.boards.assertAccess(userId, dto.boardId, 'EDITOR');

    let position = dto.position;
    if (position === undefined) {
      const max = await this.prisma.column.findFirst({
        where: { boardId: dto.boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = max ? max.position + COLUMN_POSITION_STEP : COLUMN_POSITION_STEP;
    }

    const created = await this.prisma.column.create({
      data: {
        boardId: dto.boardId,
        title: dto.title,
        position,
      },
      include: this.defaultInclude(),
    });

    this.logger.log(`Column ${created.id} created on board ${dto.boardId} by ${userId}`);
    return this.toColumnResponse(created);
  }

  /**
   * Update a column's title and/or position. Caller must have EDITOR+ access on the column's board.
   */
  async update(userId: string, columnId: string, dto: UpdateColumnDto): Promise<ColumnResponse> {
    const existing = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    });
    if (!existing) {
      throw new NotFoundException('Column not found');
    }

    await this.boards.assertAccess(userId, existing.boardId, 'EDITOR');

    const data: { title?: string; position?: number } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.position !== undefined) data.position = dto.position;

    const updated = await this.prisma.column.update({
      where: { id: columnId },
      data,
      include: this.defaultInclude(),
    });

    return this.toColumnResponse(updated);
  }

  /**
   * Delete a column. Cascades to its tasks. Refuses if the column is the last one on its board.
   */
  async remove(userId: string, columnId: string): Promise<void> {
    const existing = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    });
    if (!existing) {
      throw new NotFoundException('Column not found');
    }

    await this.boards.assertAccess(userId, existing.boardId, 'EDITOR');

    const count = await this.prisma.column.count({
      where: { boardId: existing.boardId },
    });
    if (count <= 1) {
      throw new BadRequestException(
        'Cannot delete the last remaining column. Boards must have at least one column.',
      );
    }

    await this.prisma.column.delete({ where: { id: columnId } });
    this.logger.log(`Column ${columnId} deleted from board ${existing.boardId} by ${userId}`);
  }

  /**
   * Reorder all columns on a board. `dto.columnIds` must include every existing column
   * on the board exactly once, in the desired order.
   */
  async reorder(userId: string, dto: ReorderColumnsDto): Promise<ColumnResponse[]> {
    await this.boards.assertAccess(userId, dto.boardId, 'EDITOR');

    // Verify every requested column exists and belongs to this board.
    const existing = await this.prisma.column.findMany({
      where: { boardId: dto.boardId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((c) => c.id));

    // Reject duplicates up-front.
    if (new Set(dto.columnIds).size !== dto.columnIds.length) {
      throw new BadRequestException('columnIds contains duplicates');
    }

    // Validate each requested ID exists on this board (catches both unknown
    // IDs and IDs from a different board → 404 in both cases).
    for (const id of dto.columnIds) {
      if (!existingIds.has(id)) {
        throw new NotFoundException(`Column ${id} not found on board ${dto.boardId}`);
      }
    }

    // Verify the request covers every existing column on the board.
    if (existingIds.size !== dto.columnIds.length) {
      throw new BadRequestException(
        `columnIds must contain every column on the board exactly once. Expected ${existingIds.size} IDs, got ${dto.columnIds.length}.`,
      );
    }

    // Compute fresh positions as 1024 * (i + 1) to leave headroom for fractional inserts.
    const updates = dto.columnIds.map((id, index) =>
      this.prisma.column.update({
        where: { id },
        data: { position: COLUMN_POSITION_STEP * (index + 1) },
      }),
    );

    await this.prisma.$transaction(updates);
    this.logger.log(`Columns reordered on board ${dto.boardId} by ${userId}`);

    // Re-fetch in the new order, with tasks included.
    const refreshed = await this.prisma.column.findMany({
      where: { boardId: dto.boardId },
      orderBy: { position: 'asc' },
      include: this.defaultInclude(),
    });
    return refreshed.map((c) => this.toColumnResponse(c));
  }
}
