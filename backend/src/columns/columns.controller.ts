import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ColumnsService, type ColumnResponse } from './columns.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Controller('columns')
@UseGuards(JwtAuthGuard)
export class ColumnsController {
  constructor(private readonly columns: ColumnsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateColumnDto): Promise<ColumnResponse> {
    return this.columns.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateColumnDto,
  ): Promise<ColumnResponse> {
    return this.columns.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.columns.remove(user.sub, id);
  }

  /**
   * Reorder all columns on a board. Declared before any future PUT `:id` route so the
   * literal `/reorder` segment isn't swallowed by a `:id` parameter.
   */
  @Put('reorder')
  reorder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderColumnsDto,
  ): Promise<ColumnResponse[]> {
    return this.columns.reorder(user.sub, dto);
  }
}
