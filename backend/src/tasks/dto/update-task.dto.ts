import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(200, { message: 'Title must be at most 200 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must be at most 5000 characters' })
  description?: string;

  /**
   * Pass `null` to explicitly unassign the task. Omit the field to leave assignee unchanged.
   * (class-validator's `@IsOptional()` alone treats `null` as "not provided", so we use
   * `@ValidateIf` to allow `null` to pass through for explicit unassignment.)
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4', { message: 'assigneeId must be a valid UUID' })
  assigneeId?: string | null;
}
