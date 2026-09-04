import { IsEnum, IsUUID } from 'class-validator';
import type { BoardRole } from '@prisma/client';

export class ShareBoardDto {
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId!: string;

  @IsEnum(['EDITOR', 'VIEWER'], {
    message: 'role must be EDITOR or VIEWER (OWNER cannot be granted via share)',
  })
  role!: Extract<BoardRole, 'EDITOR' | 'VIEWER'>;
}
