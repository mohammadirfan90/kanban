import { IsInt, IsUUID, Min } from 'class-validator';

export class MoveTaskDto {
  @IsUUID('4', { message: 'targetColumnId must be a valid UUID' })
  targetColumnId!: string;

  /** 0-based position in the target column AFTER the move. Must be ≥ 0. */
  @IsInt({ message: 'newIndex must be an integer' })
  @Min(0, { message: 'newIndex must be 0 or greater' })
  newIndex!: number;
}
