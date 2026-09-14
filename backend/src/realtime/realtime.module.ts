import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardsModule } from '../boards/boards.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/**
 * Global so TasksService, ColumnsService and BoardsService can inject
 * RealtimeService without each importing this module — and, more importantly,
 * without this module importing them back. The gateway depends on BoardsModule
 * (for the membership check); if the domain modules also had to import a
 * non-global RealtimeModule the graph would be circular and need forwardRef in
 * several places.
 *
 * RealtimeService holds no domain dependencies of its own, which is what keeps
 * that one-way edge honest.
 */
@Global()
@Module({
  imports: [AuthModule, BoardsModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
