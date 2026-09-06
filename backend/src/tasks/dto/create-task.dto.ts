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
} from 'class-validator';
import { TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @IsUUID('4', { message: 'columnId must be a valid UUID' })
  columnId!: string;

  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(200, { message: 'Title must be at most 200 characters' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must be at most 5000 characters' })
  description?: string;

  /**
   * Optional assignee. Must be a registered user AND a member of the parent board's
   * membership list. Service validates both before persisting.
   */
  @IsOptional()
  @IsUUID('4', { message: 'assigneeId must be a valid UUID' })
  assigneeId?: string;

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'priority must be LOW, MEDIUM, HIGH or URGENT' })
  priority?: TaskPriority;

  /**
   * ISO-8601 date or datetime. Stored as a timestamp; the UI only shows the
   * date part, but keeping the full value avoids a lossy round-trip for
   * clients that do care about time.
   */
  @IsOptional()
  @IsISO8601({}, { message: 'dueDate must be an ISO-8601 date string' })
  dueDate?: string;

  /**
   * Labels to attach on creation. Every id must belong to the same board as
   * the target column — the service rejects the whole request otherwise rather
   * than silently dropping the strays.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'A task can carry at most 20 labels' })
  @IsUUID('4', { each: true, message: 'labelIds must contain valid UUIDs' })
  labelIds?: string[];
}
