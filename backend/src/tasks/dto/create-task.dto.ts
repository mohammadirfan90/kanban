import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
}
