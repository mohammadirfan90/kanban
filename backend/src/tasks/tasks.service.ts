import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { TaskPriority } from '@prisma/client';
import { BoardsService } from '../boards/boards.service';
import { keyBetween, keyForIndex } from '../common/ordering/fractional-index';
import { withOrderingRetry } from '../common/ordering/ordering-retry';
import { TASK_INCLUDE, toTaskView, type TaskView } from '../common/task-view';
import { LabelsService } from '../labels/labels.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

// Re-exported so existing importers keep working; the shape itself lives in
// common/task-view.ts, shared with the board and column responses.
export type { TaskLabelView, TaskView } from '../common/task-view';
export type TaskResponse = TaskView;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boards: BoardsService,
    private readonly labels: LabelsService,
  ) {}

  private defaultInclude() {
    return TASK_INCLUDE;
  }

  private toTaskResponse(task: Parameters<typeof toTaskView>[0]): TaskResponse {
    return toTaskView(task);
  }

  /**
   * Resolve the parent board for a task. Throws 404 if the task doesn't exist.
   * Single DB query: `prisma.task.findUnique({ where: { id }, select: { column: { boardId } } })`.
   */
  private async resolveBoardIdForTask(taskId: string): Promise<string> {
    const row = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { column: { select: { boardId: true } } },
    });
    if (!row) {
      throw new NotFoundException('Task not found');
    }
    return row.column.boardId;
  }

  /**
   * Validate the assignee for a task:
   *   - `null` is allowed and means "explicitly unassign" (caller decides what to do)
   *   - `undefined` means "leave unchanged" — caller should skip this validation
   *   - any string UUID must (a) refer to an existing user and (b) be a member of the board
   * Throws 400 on failure with a precise message.
   */
  private async validateAssignee(
    assigneeId: string | null | undefined,
    boardId: string,
    options: { allowUnset: boolean },
  ): Promise<void> {
    if (assigneeId === undefined) return;
    if (assigneeId === null) {
      if (!options.allowUnset) {
        throw new BadRequestException('assigneeId cannot be null here');
      }
      return;
    }

    // Does the user exist?
    const user = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException(`assigneeId ${assigneeId} does not refer to a registered user`);
    }

    // Is the user a member of the board?
    const member = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: assigneeId } },
      select: { id: true },
    });
    if (!member) {
      throw new BadRequestException(`assigneeId ${assigneeId} is not a member of this board`);
    }
  }

  /** Create a task. Caller must have EDITOR+ on the parent board. */
  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponse> {
    // Resolve the column → boardId first so we can authorize + validate assignee.
    const column = await this.prisma.column.findUnique({
      where: { id: dto.columnId },
      select: { id: true, boardId: true },
    });
    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.boards.assertAccess(userId, column.boardId, 'EDITOR');

    // Assignee validation (if provided).
    if (dto.assigneeId !== undefined) {
      await this.validateAssignee(dto.assigneeId, column.boardId, { allowUnset: false });
    }

    const labelIds = dto.labelIds
      ? await this.labels.assertLabelsOnBoard(dto.labelIds, column.boardId)
      : [];

    // Append after the current last task. Re-read the tail on every attempt:
    // two clients creating into the same column simultaneously would otherwise
    // both append after the same key and collide on the unique index.
    const created = await withOrderingRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          const last = await tx.task.findFirst({
            where: { columnId: dto.columnId },
            orderBy: { position: 'desc' },
            select: { position: true },
          });

          // Atomic increment, not max(number) + 1: the latter lets two
          // concurrent creates read the same maximum and claim the same key.
          const board = await tx.board.update({
            where: { id: column.boardId },
            data: { taskCounter: { increment: 1 } },
            select: { taskCounter: true },
          });

          return tx.task.create({
            data: {
              columnId: dto.columnId,
              boardId: column.boardId,
              number: board.taskCounter,
              title: dto.title,
              description: dto.description ?? null,
              assigneeId: dto.assigneeId ?? null,
              priority: dto.priority ?? null,
              dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
              position: keyBetween(last?.position ?? null, null),
              labels: { create: labelIds.map((labelId) => ({ labelId })) },
            },
            include: this.defaultInclude(),
          });
        }),
      `create task in column ${dto.columnId}`,
    );

    this.logger.log(`Task ${created.id} created in column ${dto.columnId} by ${userId}`);
    return this.toTaskResponse(created);
  }

  /** Get a task by id. Caller must have VIEWER+ on the parent board. */
  async getOne(userId: string, taskId: string): Promise<TaskResponse> {
    const boardId = await this.resolveBoardIdForTask(taskId);
    await this.boards.assertAccess(userId, boardId, 'VIEWER');

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: this.defaultInclude(),
    });
    return this.toTaskResponse(task);
  }

  /** Update a task's title/description/assignee. Caller must have EDITOR+ on the parent board. */
  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskResponse> {
    const boardId = await this.resolveBoardIdForTask(taskId);
    await this.boards.assertAccess(userId, boardId, 'EDITOR');

    // Validate assignee if it's being touched (allow explicit null = unassign).
    if (dto.assigneeId !== undefined) {
      await this.validateAssignee(dto.assigneeId, boardId, { allowUnset: true });
    }

    // Build a partial update payload. `undefined` means "leave alone"; `null`
    // is an explicit clear, which is why each field is tested against
    // `undefined` rather than for truthiness.
    const data: {
      title?: string;
      description?: string;
      assigneeId?: string | null;
      priority?: TaskPriority | null;
      dueDate?: Date | null;
    } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    // labelIds is the desired final set, not a delta — validate before the
    // transaction so a bad id fails without having deleted anything.
    const labelIds =
      dto.labelIds !== undefined
        ? await this.labels.assertLabelsOnBoard(dto.labelIds, boardId)
        : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (labelIds !== null) {
        await tx.taskLabel.deleteMany({ where: { taskId } });
        if (labelIds.length > 0) {
          await tx.taskLabel.createMany({
            data: labelIds.map((labelId) => ({ taskId, labelId })),
          });
        }
      }
      return tx.task.update({
        where: { id: taskId },
        data,
        include: this.defaultInclude(),
      });
    });
    return this.toTaskResponse(updated);
  }

  /** Delete a task. Caller must have EDITOR+ on the parent board. */
  async remove(userId: string, taskId: string): Promise<void> {
    const boardId = await this.resolveBoardIdForTask(taskId);
    await this.boards.assertAccess(userId, boardId, 'EDITOR');

    await this.prisma.task.delete({ where: { id: taskId } });
    this.logger.log(`Task ${taskId} deleted by ${userId}`);
  }

  /**
   * Move a task within a column or across columns on the same board.
   * Caller must have EDITOR+ on the task's board.
   *
   * Ordering is conflict-free by construction:
   *
   *   1. Neighbours are read inside the retry callback, so every attempt
   *      computes its key from the *current* order rather than a stale one.
   *   2. The new key is generated strictly between the neighbours at
   *      `newIndex`, so it cannot equal any other key already in that column.
   *   3. A unique index on `(columnId, position)` rejects the one case step 2
   *      cannot prevent — a concurrent writer that read the same neighbours
   *      and computed the same key. The loser retries, now sees the winner's
   *      key among the siblings, and lands beside it instead of on it.
   *
   * The whole read-compute-write runs in a transaction so a move never
   * observes a half-applied move by someone else. The previous implementation
   * did the same work with no transaction and no uniqueness guarantee: eight
   * concurrent moves to index 0 left seven tasks sharing position 0.5.
   *
   * Cross-board moves are rejected. Allowing them would silently carry an
   * assignee onto a board they may not be a member of.
   */
  async move(userId: string, taskId: string, dto: MoveTaskDto): Promise<TaskResponse> {
    const sourceBoardId = await this.resolveBoardIdForTask(taskId);
    await this.boards.assertAccess(userId, sourceBoardId, 'EDITOR');

    const updated = await withOrderingRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          // Re-read inside the transaction: the task may have been moved or
          // deleted between the authorization check and this attempt.
          const task = await tx.task.findUnique({
            where: { id: taskId },
            select: { id: true, columnId: true },
          });
          if (!task) {
            throw new NotFoundException('Task not found');
          }

          const targetColumn = await tx.column.findUnique({
            where: { id: dto.targetColumnId },
            select: { id: true, boardId: true },
          });
          if (!targetColumn || targetColumn.boardId !== sourceBoardId) {
            throw new NotFoundException('Target column not found on this board');
          }

          // Exclude the moved task: including it would let the task act as its
          // own neighbour, and `keyBetween` would be asked to find a key
          // between a value and itself.
          const siblings = await tx.task.findMany({
            where: { columnId: dto.targetColumnId, id: { not: taskId } },
            orderBy: { position: 'asc' },
            select: { position: true },
          });

          return tx.task.update({
            where: { id: taskId },
            data: {
              columnId: dto.targetColumnId,
              position: keyForIndex(
                siblings.map((s) => s.position),
                dto.newIndex,
              ),
            },
            include: this.defaultInclude(),
          });
        }),
      `move task ${taskId}`,
    );

    this.logger.log(
      `Task ${taskId} moved to column ${dto.targetColumnId} position ${updated.position} by ${userId}`,
    );
    return this.toTaskResponse(updated);
  }
}
