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
import { ActorSocket } from '../realtime/actor-socket.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService, type TaskResponse } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
    @ActorSocket() socketId: string | null,
  ): Promise<TaskResponse> {
    return this.tasks.create(user.sub, dto, socketId);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<TaskResponse> {
    return this.tasks.getOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTaskDto,
    @ActorSocket() socketId: string | null,
  ): Promise<TaskResponse> {
    return this.tasks.update(user.sub, id, dto, socketId);
  }

  @Patch(':id/move')
  move(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MoveTaskDto,
    @ActorSocket() socketId: string | null,
  ): Promise<TaskResponse> {
    return this.tasks.move(user.sub, id, dto, socketId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @ActorSocket() socketId: string | null,
  ): Promise<void> {
    return this.tasks.remove(user.sub, id, socketId);
  }
}
