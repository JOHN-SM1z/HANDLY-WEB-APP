import { Module } from '@nestjs/common';
import { PenaltiesModule } from '../penalties/penalties.module';
import { TrustModule } from '../trust/trust.module';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TrustModule, PenaltiesModule],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
