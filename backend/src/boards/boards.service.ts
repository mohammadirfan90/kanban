import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Board, BoardMember, BoardRole, Column, Task, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { ShareBoardDto } from './dto/share-board.dto';

/** Role-hierarchy comparison: OWNER > EDITOR > VIEWER. */
const ROLE_RANK: Record<BoardRole, number> = {
  OWNER: 2,
  EDITOR: 1,
  VIEWER: 0,
};

// Shape returned to clients. Stable for all get/list responses.
export interface BoardResponse {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  role: BoardRole;
  members: BoardMemberView[];
  columns: BoardColumnView[];
}

export interface BoardMemberView {
  userId: string;
  email: string;
  name: string;
  role: BoardRole;
}

export interface BoardColumnView {
  id: string;
  title: string;
  position: number;
  tasks: BoardTaskView[];
}

export interface BoardTaskView {
  id: string;
  title: string;
  description: string | null;
  position: number;
  assignee: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class BoardsService {
  private readonly logger = new Logger(BoardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the caller's role on a board (or null if no access). */
  async getRole(userId: string, boardId: string): Promise<BoardRole | null> {
    const member = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { role: true },
    });
    return member?.role ?? null;
  }

  /** Throws 404 if no board, 403 if caller lacks the minimum role. */
  async assertAccess(
    userId: string,
    boardId: string,
    minRole: BoardRole = 'VIEWER',
  ): Promise<BoardRole> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const role = await this.getRole(userId, boardId);
    if (!role) {
      throw new ForbiddenException('You do not have access to this board');
    }
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(`Requires ${minRole} role or higher`);
    }
    return role;
  }

  /**
   * Boolean convenience check: returns true iff the user has at least `minRole` on the board.
   * Single DB round-trip via getRole; does not throw. Useful for conditional UI/logic.
   */
  async hasAccess(
    userId: string,
    boardId: string,
    minRole: BoardRole = 'VIEWER',
  ): Promise<boolean> {
    const role = await this.getRole(userId, boardId);
    return role !== null && ROLE_RANK[role] >= ROLE_RANK[minRole];
  }

  async listForUser(userId: string): Promise<BoardResponse[]> {
    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      select: { role: true, boardId: true },
    });
    if (memberships.length === 0) return [];

    const boardIds = memberships.map((m) => m.boardId);
    const boards = await this.prisma.board.findMany({
      where: { id: { in: boardIds } },
      orderBy: { updatedAt: 'desc' },
      include: this.defaultInclude(),
    });

    // Map each board to its caller's role in one pass.
    const roleByBoard = new Map<string, BoardRole>(memberships.map((m) => [m.boardId, m.role]));
    return boards.map((b) => this.toBoardResponse(b, roleByBoard.get(b.id) ?? 'VIEWER'));
  }

  async getOne(userId: string, boardId: string): Promise<BoardResponse> {
    const role = await this.assertAccess(userId, boardId, 'VIEWER');
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: this.defaultInclude(),
    });
    // board cannot be null because assertAccess already checked
    return this.toBoardResponse(board!, role);
  }

  async create(userId: string, dto: CreateBoardDto): Promise<BoardResponse> {
    // Transaction: Board + OWNER BoardMember + 3 default Columns (positions 1024, 2048, 3072)
    const created = await this.prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          ownerId: userId,
        },
      });
      await tx.boardMember.create({
        data: { boardId: board.id, userId, role: 'OWNER' },
      });
      await tx.column.createMany({
        data: [
          { boardId: board.id, title: 'To Do', position: 1024 },
          { boardId: board.id, title: 'In Progress', position: 2048 },
          { boardId: board.id, title: 'Done', position: 3072 },
        ],
      });
      return board;
    });

    this.logger.log(`Board ${created.id} created by ${userId}`);

    // Re-fetch with full include to build the response.
    const full = await this.prisma.board.findUniqueOrThrow({
      where: { id: created.id },
      include: this.defaultInclude(),
    });
    return this.toBoardResponse(full, 'OWNER');
  }

  async update(userId: string, boardId: string, dto: UpdateBoardDto): Promise<BoardResponse> {
    await this.assertAccess(userId, boardId, 'EDITOR');

    const updated = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
      include: this.defaultInclude(),
    });

    const role = (await this.getRole(userId, boardId)) ?? 'VIEWER';
    return this.toBoardResponse(updated, role);
  }

  async remove(userId: string, boardId: string): Promise<void> {
    await this.assertAccess(userId, boardId, 'OWNER');
    await this.prisma.board.delete({ where: { id: boardId } });
    this.logger.log(`Board ${boardId} deleted by ${userId}`);
  }

  async share(userId: string, boardId: string, dto: ShareBoardDto): Promise<BoardResponse> {
    await this.assertAccess(userId, boardId, 'OWNER');

    // Don't let the owner share with themselves.
    if (dto.userId === userId) {
      throw new BadRequestException('You cannot share a board with yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    const existing = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: dto.userId } },
      select: { id: true, role: true },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this board');
    }

    await this.prisma.boardMember.create({
      data: { boardId, userId: dto.userId, role: dto.role },
    });

    this.logger.log(`Board ${boardId} shared with ${dto.userId} as ${dto.role}`);

    // Return the board from the caller's perspective.
    return this.getOne(userId, boardId);
  }

  async revoke(userId: string, boardId: string, targetUserId: string): Promise<void> {
    await this.assertAccess(userId, boardId, 'OWNER');

    if (targetUserId === userId) {
      throw new BadRequestException('Cannot revoke the owner of the board');
    }

    const existing = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      select: { id: true },
    });
    if (!existing) {
      // Idempotent: nothing to revoke.
      return;
    }

    await this.prisma.boardMember.delete({ where: { id: existing.id } });
    this.logger.log(`Board ${boardId}: revoked access for ${targetUserId}`);
  }

  // --- Helpers ----------------------------------------------------------

  /** Standard include shape used by all read responses. */
  private defaultInclude() {
    return {
      members: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
      columns: {
        orderBy: { position: 'asc' as const },
        include: {
          tasks: {
            orderBy: { position: 'asc' as const },
            include: {
              assignee: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    };
  }

  private toBoardResponse(
    board: Board & {
      members: (BoardMember & { user: Pick<User, 'id' | 'email' | 'name'> })[];
      columns: (Column & {
        tasks: (Task & { assignee: { id: string; name: string; email: string } | null })[];
      })[];
    },
    callerRole: BoardRole,
  ): BoardResponse {
    return {
      id: board.id,
      title: board.title,
      description: board.description,
      ownerId: board.ownerId,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      role: callerRole,
      members: board.members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
      })),
      columns: board.columns.map((c) => ({
        id: c.id,
        title: c.title,
        position: c.position,
        tasks: c.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          position: t.position,
          assignee: t.assignee,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      })),
    };
  }
}
