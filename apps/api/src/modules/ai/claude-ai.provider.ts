import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zodOutputFormat's types require the zod/v4 surface; the rest of the codebase
// uses classic zod v3 (packages/contracts) — scoped to this file only.
import * as z from 'zod/v4';
import { AppConfig } from '../../infra/config/app-config';
import {
  type AiProvider,
  type DiagnoseInput,
  type Diagnosis,
  DIAGNOSIS_PROMPT_VERSION,
} from './ai-provider';

/**
 * Claude-backed diagnosis (vision + structured output). Selected by
 * AI_PROVIDER=claude + ANTHROPIC_API_KEY. Errors/timeouts bubble to AiService,
 * which falls back to the deterministic mock — AI assists, never gates.
 */
@Injectable()
export class ClaudeAiProvider implements AiProvider {
  private readonly logger = new Logger('ClaudeAi');
  private client?: Anthropic;

  constructor(private readonly config: AppConfig) {}

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.config.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async diagnose(input: DiagnoseInput): Promise<Diagnosis> {
    const slugs = input.categories.map((c) => c.slug);
    const outputSchema = z.object({
      issue_summary: z
        .string()
        .describe("2-3 jumlada muammoning tashxisi, o'zbek tilida, mijozga tushunarli"),
      category_slug: z.enum(slugs as [string, ...string[]]).describe('Eng mos xizmat turi'),
      complexity: z.enum(['SIMPLE', 'MEDIUM', 'COMPLEX', 'CRITICAL']),
      confidence: z.number().min(0).max(1),
    });

    const categoryList = input.categories.map((c) => `- ${c.slug}: ${c.nameUz}`).join('\n');
    const prompt = [
      "Siz Handly (O'zbekistondagi uy xizmatlari platformasi) uchun tashxis yordamchisisiz.",
      "Mijoz muammosini va (bo'lsa) rasmlarni tahlil qilib, tashxis qo'ying.",
      '',
      'Xizmat turlari:',
      categoryList,
      '',
      'Murakkablik darajalari: SIMPLE (kichik tuzatish), MEDIUM (odatiy ish), COMPLEX (katta hajm/almashtirish), CRITICAL (avariya, xavfli holat).',
      `Xizmat rejimi: ${input.serviceTier}`,
      '',
      `Mijoz tavsifi: """${input.description}"""`,
    ].join('\n');

    const content: Anthropic.ContentBlockParam[] = [
      ...input.images.map(
        (img): Anthropic.ImageBlockParam => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
        }),
      ),
      { type: 'text', text: prompt },
    ];

    const response = await this.getClient().messages.parse(
      {
        model: this.config.env.AI_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
        output_config: { format: zodOutputFormat(outputSchema) },
      },
      { timeout: this.config.env.AI_TIMEOUT_MS, maxRetries: 1 },
    );

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw new Error(`Claude diagnosis unavailable (stop_reason=${response.stop_reason})`);
    }

    const out = response.parsed_output;
    const match = input.categories.find((c) => c.slug === out.category_slug);
    this.logger.log(
      `Diagnosis via ${this.config.env.AI_MODEL}: category=${out.category_slug} complexity=${out.complexity} confidence=${out.confidence}`,
    );

    return {
      issueSummary: out.issue_summary,
      suggestedCategoryId: match?.id ?? null,
      suggestedCategorySlug: match?.slug ?? null,
      complexity: out.complexity,
      confidence: out.confidence,
      source: 'claude',
      promptVersion: DIAGNOSIS_PROMPT_VERSION,
    };
  }
}
