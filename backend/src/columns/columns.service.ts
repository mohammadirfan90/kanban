import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Column } from '@prisma/client';
import { BoardsService } from '../boards/boards.service';
import { keyBetween, keysBetween, type OrderKey } from '../common/ordering/fractional-index';
import { withOrderingRetry } from '../common/ordering/ordering-retry';
import { TASK_INCLUDE, toTaskView, type TaskView } from '../common/task-view';
import { PrismaService } from '../prisma/prisma.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

// Shared with the board and task endpoints — see common/task-view.ts.
export type { TaskView } from '../common/task-view';

export interface ColumnResponse {
  id: string;
  boardId: string;
  title: string;
  position: OrderKey;
  createdAt: string;
  updatedAt: string;
  tasks: TaskView[];
}

@Injectable()
export class ColumnsService {
  private readonly logger = new Logger(ColumnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boards: BoardsService,
  ) {}

  /**
   * Default include for column responses: tasks ordered by fractional position, with
   * each task's assignee eager-loaded (id/name/email only — never passwordHash).
   * Prevents N+1 when a board returns its columns + their tasks.
   */
  private defaultInclude() {
    return {
      tasks: {
        orderBy: { position: 'asc' as const },
        include: TASK_INCLUDE,
      },
    };
  }

  private toColumnResponse(
    column: Column & { tasks: Parameters<typeof toTaskView>[0][] },
  ): ColumnResponse {
    return {
      id: column.id,
      boardId: column.boardId,
      title: column.title,
      position: column.position,
      createdAt: column.createdAt.toISOString(),
      updatedAt: column.updatedAt.toISOString(),
      tasks: column.tasks.map((t) => toTaskView(t)),
    };
  }

  /**
   * Create a column on a board. Caller must have EDITOR+ access.
   * New columns always append; ordering keys are server-generated.
   */
  async create(userId: string, dto: CreateColumnDto): Promise<ColumnResponse> {
    await this.boards.assertAccess(userId, dto.boardId, 'EDITOR');

    // Append after the current last column, re-reading the tail on each
    // attempt so two concurrent creates don't both append after the same key.
    const created = await withOrderingRetry(async () => {
      const last = await this.prisma.column.findFirst({
        where: { boardId: dto.boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return this.prisma.column.create({
        data: {
          boardId: dto.boardId,
          title: dto.title,
          position: keyBetween(last?.position ?? null, null),
        },
        include: this.defaultInclude(),
      });
    }, `create column on board ${dto.boardId}`);

    this.logger.log(`Column ${created.id} created on board ${dto.boardId} by ${userId}`);
    return this.toColumnResponse(created);
  }

  /**
   * Rename a column. Caller must have EDITOR+ access on the column's board.
   * Position is not settable here — reordering goes through `reorder`.
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

    const data: { title?: string } = {};
    if (dto.title !== undefined) data.title = dto.title;

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

    // Allocate a fresh block of keys entirely AFTER the current maximum.
    //
    // The obvious approach — hand out a0, a1, a2… from the start of the key
    // space — deadlocks against the unique (boardId, position) index. Postgres
    // enforces a unique index per statement, not at commit, so a reorder that
    // merely swaps two columns would assign B's key to A while B still holds
    // it and fail mid-transaction. Allocating past the tail means no new key
    // can equal a key still in use, so the updates can be applied in any order
    // without an intermediate placeholder pass or a DEFERRABLE constraint.
    //
    // Keys grow slowly as a result (a0 → a1 → … → b00), which is inherent to
    // fractional indexing and costs a byte or two per reorder — cheap next to
    // the alternative.
    const refreshed = await withOrderingRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          const last = await tx.column.findFirst({
            where: { boardId: dto.boardId },
            orderBy: { position: 'desc' },
            select: { position: true },
          });

          const keys = keysBetween(last?.position ?? null, null, dto.columnIds.length);

          // Sequential rather than Promise.all: concurrent updates inside one
          // transaction can interleave on the same index pages and deadlock.
          for (const [index, id] of dto.columnIds.entries()) {
            await tx.column.update({ where: { id }, data: { position: keys[index] } });
          }

          return tx.column.findMany({
            where: { boardId: dto.boardId },
            orderBy: { position: 'asc' },
            include: this.defaultInclude(),
          });
        }),
      `reorder columns on board ${dto.boardId}`,
    );

    this.logger.log(`Columns reordered on board ${dto.boardId} by ${userId}`);
    return refreshed.map((c) => this.toColumnResponse(c));
  }
}
