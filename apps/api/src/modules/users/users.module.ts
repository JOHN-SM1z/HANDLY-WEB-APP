import { Module } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [MeController, MasterController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
