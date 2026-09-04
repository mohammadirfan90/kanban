import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Task } from '@prisma/client';
import { BoardsService } from '../boards/boards.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export interface TaskResponse {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  assignee: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Default position step when appending a new task to the end of a column. */
const TASK_POSITION_STEP = 1;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boards: BoardsService,
  ) {}

  /** Eager-load the assignee user (id/name/email only — never passwordHash). */
  private defaultInclude() {
    return {
      assignee: {
        select: { id: true, name: true, email: true },
      },
    };
  }

  private toTaskResponse(
    task: Task & { assignee: { id: string; name: string; email: string } | null },
  ): TaskResponse {
    return {
      id: task.id,
      columnId: task.columnId,
      title: task.title,
      description: task.description,
      position: task.position,
      assignee: task.assignee,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
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

    // Compute position: append after max(existing positions) in this column.
    const max = await this.prisma.task.findFirst({
      where: { columnId: dto.columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (max?.position ?? 0) + TASK_POSITION_STEP;

    const created = await this.prisma.task.create({
      data: {
        columnId: dto.columnId,
        title: dto.title,
        description: dto.description ?? null,
        assigneeId: dto.assigneeId ?? null,
        position,
      },
      include: this.defaultInclude(),
    });

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

    // Build a partial update payload.
    const data: { title?: string; description?: string; assigneeId?: string | null } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId; // null unassigns, string sets, undefined left out

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data,
      include: this.defaultInclude(),
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
}
