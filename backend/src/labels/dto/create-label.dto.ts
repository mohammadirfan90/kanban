import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { LABEL_COLORS } from '../labels.service';

export class CreateLabelDto {
  @IsString()
  @MinLength(1, { message: 'Label name is required' })
  @MaxLength(40, { message: 'Label name must be at most 40 characters' })
  name!: string;

  // A palette token, not a hex value — see LABEL_COLORS.
  @IsIn(LABEL_COLORS as unknown as string[], {
    message: `color must be one of: ${LABEL_COLORS.join(', ')}`,
  })
  color!: string;
}
