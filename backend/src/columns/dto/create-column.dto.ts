import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateColumnDto {
  @IsUUID('4', { message: 'boardId must be a valid UUID' })
  boardId!: string;

  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title!: string;

  /**
   * Optional explicit position (fractional index). If omitted, the column
   * is appended after the highest existing position for the board.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  position?: number;
}
