import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';

@Module({
  imports: [PrismaModule, BoardsModule],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
