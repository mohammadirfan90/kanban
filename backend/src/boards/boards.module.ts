import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller';
import { PublicBoardsController } from './public-boards.controller';
import { BoardsService } from './boards.service';
import { PublicLinksService } from './public-links.service';

@Module({
  // PublicBoardsController is registered here rather than in its own module so
  // it stays next to the service that owns slug resolution. It carries no
  // JwtAuthGuard of its own and BoardsController's class-level guard does not
  // reach it, since guards are per-controller.
  controllers: [BoardsController, PublicBoardsController],
  providers: [BoardsService, PublicLinksService],
  exports: [BoardsService, PublicLinksService],
})
export class BoardsModule {}
