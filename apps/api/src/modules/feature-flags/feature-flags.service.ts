import { Injectable } from '@nestjs/common';
import type { FeatureFlagDto } from '@handly/contracts';
import type { FeatureFlag } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Configuration/feature-flag foundation (Batch 3 scope) — flat key/value,
 * nothing reads these to gate behavior yet. See schema.prisma's FeatureFlag
 * doc comment for why this isn't the full versioned rules engine.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<FeatureFlagDto[]> {
    const rows = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return rows.map((r) => this.toDto(r));
  }

  /** Upsert is naturally idempotent — same input twice yields the same row state. */
  async upsert(
    adminId: string,
    key: string,
    enabled: boolean,
    description?: string,
  ): Promise<FeatureFlagDto> {
    const before = await this.prisma.featureFlag.findUnique({ where: { key } });
    const after = await this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled, description },
      update: { enabled, description },
    });
    await this.audit.record(
      adminId,
      before ? 'FEATURE_FLAG_UPDATE' : 'FEATURE_FLAG_CREATE',
      'FeatureFlag',
      key,
      before ? this.toDto(before) : undefined,
      this.toDto(after),
    );
    return this.toDto(after);
  }

  private toDto(f: FeatureFlag): FeatureFlagDto {
    return {
      key: f.key,
      enabled: f.enabled,
      description: f.description,
      updatedAt: f.updatedAt.toISOString(),
    };
  }
}
