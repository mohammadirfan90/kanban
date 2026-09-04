import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { ColumnsModule } from '../columns/columns.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [BoardsModule, ColumnsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
