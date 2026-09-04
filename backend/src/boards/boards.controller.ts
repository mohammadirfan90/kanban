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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BoardsService, type BoardResponse } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { ShareBoardDto } from './dto/share-board.dto';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<BoardResponse[]> {
    return this.boards.listForUser(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBoardDto): Promise<BoardResponse> {
    return this.boards.create(user.sub, dto);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BoardResponse> {
    return this.boards.getOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBoardDto,
  ): Promise<BoardResponse> {
    return this.boards.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.boards.remove(user.sub, id);
  }

  @Post(':id/share')
  @HttpCode(HttpStatus.CREATED)
  share(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ShareBoardDto,
  ): Promise<BoardResponse> {
    return this.boards.share(user.sub, id, dto);
  }

  @Delete(':id/share/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.boards.revoke(user.sub, id, userId);
  }
}
