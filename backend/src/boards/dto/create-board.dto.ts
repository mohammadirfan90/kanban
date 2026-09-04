import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must be at most 1000 characters' })
  description?: string;
}
