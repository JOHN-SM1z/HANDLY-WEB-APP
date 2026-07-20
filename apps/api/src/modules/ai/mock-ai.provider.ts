import { Injectable } from '@nestjs/common';
import { Complexity } from '@handly/contracts';
import {
  type AiProvider,
  type DiagnoseInput,
  type Diagnosis,
  DIAGNOSIS_PROMPT_VERSION,
} from './ai-provider';

/**
 * Deterministic fallback diagnosis — keyword heuristics over the description
 * (uz/ru). Always available; the quality bar is "useful default", not "smart".
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plumber: ['kran', 'suv', 'quvur', 'oqmoqda', 'oqyapti', 'santex', 'unitaz', 'rakovina', 'вода', 'кран', 'труб', 'течет', 'сантех'],
  electrician: ['rozetka', 'tok', 'elektr', 'chiroq', 'svet', 'vyklyuchatel', 'sim', 'провод', 'розетк', 'свет', 'электр', 'выключател'],
  'ac-technician': ['konditsioner', 'kondey', 'sovutish', 'kondits', 'кондиционер', 'кондей', 'охлажд'],
  cleaner: ['tozalash', 'toza', 'yuvish', 'uborka', 'уборк', 'чист', 'мыть'],
  renovation: ["ta'mir", 'tamir', 'devor', 'shtukatur', 'oboyi', 'gips', 'pol ', 'ремонт', 'стен', 'штукатур', 'обои'],
  handyman: ['osish', "o'rnatish", 'ornatish', 'yigish', "mebel'", 'mebel', 'polka', 'karniz', 'повесить', 'собрать', 'мебель', 'установ'],
};

const CRITICAL_KEYWORDS = ['portla', 'gaz', 'suv bosdi', 'toshdi', 'tok urdi', 'yong', 'kuydi', 'затопил', 'потоп', 'взрыв', 'горит', 'пожар', 'бьет током'];
const COMPLEX_KEYWORDS = ['almashtirish', 'montaj', "to'liq", 'toliq', 'butun', 'hammasi', 'замен', 'монтаж', 'полность', 'весь'];

@Injectable()
export class MockAiProvider implements AiProvider {
  async diagnose(input: DiagnoseInput): Promise<Diagnosis> {
    const text = input.description.toLowerCase();

    // Category: best keyword-hit count wins; ties keep the customer's choice.
    let bestSlug: string | null = null;
    let bestHits = 0;
    for (const [slug, words] of Object.entries(CATEGORY_KEYWORDS)) {
      const hits = words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
      if (hits > bestHits) {
        bestHits = hits;
        bestSlug = slug;
      }
    }
    const match = bestSlug ? input.categories.find((c) => c.slug === bestSlug) : undefined;

    const complexity = this.classifyComplexity(text, input);
    const confidence = Math.min(0.85, 0.5 + bestHits * 0.1);

    const categoryName = match?.nameUz ?? input.categories.find((c) => c.id === input.currentCategoryId)?.nameUz;
    const summary = this.summarize(input.description, categoryName, complexity);

    return {
      issueSummary: summary,
      suggestedCategoryId: match?.id ?? null,
      suggestedCategorySlug: match?.slug ?? null,
      complexity,
      confidence,
      source: 'mock',
      promptVersion: DIAGNOSIS_PROMPT_VERSION,
    };
  }

  private classifyComplexity(text: string, input: DiagnoseInput): Complexity {
    if (input.serviceTier === 'EMERGENCY' || CRITICAL_KEYWORDS.some((w) => text.includes(w))) {
      return Complexity.CRITICAL;
    }
    if (COMPLEX_KEYWORDS.some((w) => text.includes(w)) || text.length > 400) {
      return Complexity.COMPLEX;
    }
    if (text.length < 60) return Complexity.SIMPLE;
    return Complexity.MEDIUM;
  }

  private summarize(description: string, categoryName: string | undefined, complexity: Complexity): string {
    const head = description.length > 140 ? `${description.slice(0, 140)}…` : description;
    const kind = categoryName ? `${categoryName} bo'yicha muammo` : 'Uy xizmati muammosi';
    const level =
      complexity === 'CRITICAL'
        ? 'Shoshilinch aralashuv talab qilinishi mumkin.'
        : complexity === 'COMPLEX'
          ? "Katta hajmdagi ish bo'lishi mumkin."
          : "Usta joyida aniq baholab beradi.";
    return `${kind}: "${head}". ${level}`;
  }
}
