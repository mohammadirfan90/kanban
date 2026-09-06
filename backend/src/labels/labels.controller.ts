import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelsService, type LabelResponse } from './labels.service';

/**
 * Labels are board-scoped, so listing and creation hang off /boards/:boardId,
 * while mutating an existing label addresses it directly by id.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get('boards/:boardId/labels')
  list(
    @CurrentUser() user: JwtPayload,
    @Param('boardId', new ParseUUIDPipe({ version: '4' })) boardId: string,
  ): Promise<LabelResponse[]> {
    return this.labels.listForBoard(user.sub, boardId);
  }

  @Post('boards/:boardId/labels')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('boardId', new ParseUUIDPipe({ version: '4' })) boardId: string,
    @Body() dto: CreateLabelDto,
  ): Promise<LabelResponse> {
    return this.labels.create(user.sub, boardId, dto);
  }

  @Patch('labels/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLabelDto,
  ): Promise<LabelResponse> {
    return this.labels.update(user.sub, id, dto);
  }

  @Delete('labels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.labels.remove(user.sub, id);
  }
}
