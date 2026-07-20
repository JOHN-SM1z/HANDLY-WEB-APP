import type { Complexity, ServiceTier } from '@handly/contracts';

/** Prompt/heuristic version recorded with every diagnosis for auditability. */
export const DIAGNOSIS_PROMPT_VERSION = 'v1';

export interface DiagnoseCategory {
  id: string;
  slug: string;
  nameUz: string;
}

export interface DiagnoseImage {
  /** Claude vision supports jpeg/png/webp/gif. */
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  base64: string;
}

export interface DiagnoseInput {
  description: string;
  serviceTier: ServiceTier;
  categories: DiagnoseCategory[];
  currentCategoryId: string | null;
  images: DiagnoseImage[];
}

export interface Diagnosis {
  issueSummary: string;
  suggestedCategoryId: string | null;
  suggestedCategorySlug: string | null;
  complexity: Complexity;
  /** 0..1 */
  confidence: number;
  source: 'claude' | 'mock';
  promptVersion: string;
}

export interface AiProvider {
  diagnose(input: DiagnoseInput): Promise<Diagnosis>;
}
