import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../infra/config/app-config';
import type { DiagnoseInput, Diagnosis } from './ai-provider';
import { ClaudeAiProvider } from './claude-ai.provider';
import { MockAiProvider } from './mock-ai.provider';

/**
 * Facade the rest of the app talks to. Picks Claude when configured, and
 * ALWAYS falls back to the deterministic mock on any failure — the order
 * flow must never be blocked by the AI layer.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly claude: ClaudeAiProvider,
    private readonly mock: MockAiProvider,
  ) {}

  private claudeEnabled(): boolean {
    return this.config.env.AI_PROVIDER === 'claude' && this.config.env.ANTHROPIC_API_KEY.length > 0;
  }

  async diagnose(input: DiagnoseInput): Promise<Diagnosis> {
    if (this.claudeEnabled()) {
      try {
        return await this.claude.diagnose(input);
      } catch (err) {
        this.logger.warn(
          `Claude diagnosis failed, falling back to mock: ${(err as Error).message}`,
        );
      }
    }
    return this.mock.diagnose(input);
  }
}
