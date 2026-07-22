// Handly — root ESLint flat config (Batch 4). Covers apps/api and
// packages/*; apps/web has its own config (Next-specific, see
// apps/web/eslint.config.mjs) and is excluded here.
//
// Scope is deliberately the TypeScript-recommended rule set, not
// "recommended-type-checked" or anything stricter — this is a first-time
// lint setup for an existing, already-shipped codebase (M1 through Batch 3),
// and the goal is catching real bugs in CI going forward, not a mass
// stylistic rewrite of previously-approved code. Tightening the rule set is
// a good follow-up once this baseline is green.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'apps/web/**',
      '_to_delete/**',
      'graphify-out/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // This codebase's established convention (CLAUDE.md: "Default to
      // writing no comments... only add one when the WHY is non-obvious")
      // relies heavily on `_`-prefixed intentionally-unused params
      // (interceptors, guards, decorators) — flag genuinely dead vars, not that.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Every raw SQL / Prisma untyped result in this codebase already casts
      // deliberately (e.g. dispatch-eligibility.ts's $queryRaw<T>) — this
      // would need a type-checked lint pass to police properly, not a
      // reasonable ask for the first-ever lint setup.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
