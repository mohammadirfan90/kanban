import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title?: string;

  // `position` intentionally omitted — see CreateColumnDto. Reordering goes
  // through PATCH /columns/reorder, which places by index and is retry-safe.
}
