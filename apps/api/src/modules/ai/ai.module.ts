import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ClaudeAiProvider } from './claude-ai.provider';
import { MockAiProvider } from './mock-ai.provider';

@Module({
  providers: [AiService, ClaudeAiProvider, MockAiProvider],
  exports: [AiService],
})
export class AiModule {}
