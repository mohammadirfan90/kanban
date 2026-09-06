import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateColumnDto {
  @IsUUID('4', { message: 'boardId must be a valid UUID' })
  boardId!: string;

  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title!: string;

  // No `position` field by design. Ordering keys are opaque fractional
  // indices; letting a client supply one would (a) allow malformed keys that
  // break lexicographic sorting and (b) bypass the conflict-free placement in
  // ColumnsService. New columns append; placement is expressed as intent via
  // PATCH /columns/reorder.
}
