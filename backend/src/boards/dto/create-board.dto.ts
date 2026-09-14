import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BOARD_BACKGROUNDS } from '../board-background';

export class CreateBoardDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must be at most 1000 characters' })
  description?: string;

  /**
   * Palette token, not a colour. See BOARD_BACKGROUNDS.
   *
   * Empty string is accepted as "reset to the default surface", because a
   * JSON body cannot easily express "unset" any other way through
   * class-validator.
   */
  @IsOptional()
  @IsIn([...BOARD_BACKGROUNDS, ''], {
    message: `background must be one of: ${BOARD_BACKGROUNDS.join(', ')}`,
  })
  background?: string;
}
