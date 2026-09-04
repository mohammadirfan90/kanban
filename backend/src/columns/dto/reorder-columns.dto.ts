import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderColumnsDto {
  @IsUUID('4', { message: 'boardId must be a valid UUID' })
  boardId!: string;

  /**
   * Column IDs in the desired order (left-to-right). All IDs must belong to `boardId`.
   * The set must include every column currently on the board — partial reorders are rejected.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'columnIds must not be empty' })
  @IsUUID('4', { each: true, message: 'each columnId must be a valid UUID' })
  columnIds!: string[];
}
