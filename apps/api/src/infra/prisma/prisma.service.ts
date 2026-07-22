import { Injectable, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query'> implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() private readonly metrics?: MetricsService) {
    // Event-based query logging (Prisma 6's supported mechanism — `$use`
    // middleware was removed; this needs no change to how every existing
    // service already calls `this.prisma.<model>.<action>()`).
    super({ log: [{ emit: 'event', level: 'query' }] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    if (this.metrics) {
      this.$on('query', (e) => {
        const [model, action] = parseQueryTarget(e.query);
        this.metrics!.dbQueryDuration.observe({ model, action }, e.duration / 1000);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Prisma's query event gives the raw SQL, not a (model, action) pair — pull
 * the target table out of the SQL itself (good enough for a metrics label,
 * not meant to be a full SQL parser). Falls back to "unknown" for the raw
 * `$queryRaw`/`$executeRaw` call sites (dispatch-eligibility.ts etc.), which
 * is an honest label rather than a misleading guess.
 *
 * Found live during Batch 4's load test: `admin-analytics.service.ts`'s
 * `EXTRACT(EPOCH FROM "respondedAt" - "offeredAt")` aggregate queries were
 * mislabeled model="respondedat" — the naive regex matched EXTRACT's own
 * `FROM` keyword (part of the EXTRACT(field FROM source) syntax, not a table
 * clause) before ever reaching the real `FROM order_dispatches`. Stripping
 * EXTRACT(...) calls first fixes this and lets those two queries correctly
 * fall back to "unknown" (still an honest label — this function was never
 * meant to fully parse a `FROM table JOIN table2 ...` raw query, just the
 * common single-table case).
 */
export function parseQueryTarget(sql: string): [model: string, action: string] {
  const withoutExtract = sql.replace(/EXTRACT\s*\([^()]*\)/gi, 'EXTRACT()');
  // Postgres SQL is schema-qualified ("public"."orders") — skip the schema
  // segment and capture the actual table name, not "public" for every row.
  const match = /^\s*(SELECT|INSERT|UPDATE|DELETE)\b.*?\b(?:FROM|INTO|UPDATE)\s+(?:"?\w+"?\.)?"?(\w+)"?/i.exec(
    withoutExtract,
  );
  if (!match) return ['unknown', 'unknown'];
  return [match[2]!.toLowerCase(), match[1]!.toLowerCase()];
}
