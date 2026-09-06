import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TaskPriority } from '@prisma/client';

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

  /** `null` clears the priority; omit to leave it unchanged. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(TaskPriority, { message: 'priority must be LOW, MEDIUM, HIGH or URGENT' })
  priority?: TaskPriority | null;

  /** `null` clears the due date; omit to leave it unchanged. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({}, { message: 'dueDate must be an ISO-8601 date string' })
  dueDate?: string | null;

  /**
   * Replaces the task's labels wholesale — the array is the desired final set,
   * not a delta. An empty array clears them. Omit the field to leave them alone.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'A task can carry at most 20 labels' })
  @IsUUID('4', { each: true, message: 'labelIds must contain valid UUIDs' })
  labelIds?: string[];
}
