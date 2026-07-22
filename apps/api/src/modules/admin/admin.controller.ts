import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  adminGuaranteeClaimListQuerySchema,
  adminVerificationListQuerySchema,
  guaranteeClaimDecisionSchema,
  verificationDecisionSchema,
} from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GuaranteeService } from '../guarantee/guarantee.service';
import { VerificationService } from '../verification/verification.service';

/**
 * Admin-ready decision endpoints (Batch 2), now fronted by the Batch 3
 * dashboard. List queries read the `Verification`/`GuaranteeClaim` tables
 * directly (read-only) rather than adding list methods to those Batch 2
 * services — same "admin reads across module boundaries for reporting"
 * pattern already used by AdminOrdersService/AdminSupportService. Every
 * decide call is now audit-logged with a real before/after snapshot.
 */
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly verification: VerificationService,
    private readonly guarantee: GuaranteeService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('verifications')
  async listVerifications(
    @Query(new ZodValidationPipe(adminVerificationListQuerySchema))
    query: ReturnType<typeof adminVerificationListQuerySchema.parse>,
  ) {
    const rows = await this.prisma.verification.findMany({
      where: query.status ? { status: query.status } : { status: 'PENDING' },
      include: {
        master: {
          include: {
            user: { select: { phone: true } },
            // Beta Blocker Sprint — the master's uploaded certification
            // photos, so a decide() call isn't made blind on note text alone.
            media: { where: { kind: 'CERTIFICATION' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      masterId: r.masterId,
      masterPhone: r.master.user.phone,
      status: r.status,
      note: r.note,
      certifications: r.master.media.map((m) => ({ id: m.id, url: `/api/v1/media/master/${m.id}`, caption: m.caption })),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Post('verifications/:id/decide')
  @HttpCode(200)
  async decideVerification(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(verificationDecisionSchema)) dto: ReturnType<typeof verificationDecisionSchema.parse>,
  ) {
    const before = await this.prisma.verification.findUnique({ where: { id } });
    const result = await this.verification.decide(id, adminId, dto.approve, dto.note);
    await this.audit.record(
      adminId,
      dto.approve ? 'VERIFICATION_APPROVE' : 'VERIFICATION_REJECT',
      'Verification',
      id,
      before ? { status: before.status } : undefined,
      { status: result.status },
    );
    return result;
  }

  @Get('guarantee-claims')
  async listGuaranteeClaims(
    @Query(new ZodValidationPipe(adminGuaranteeClaimListQuerySchema))
    query: ReturnType<typeof adminGuaranteeClaimListQuerySchema.parse>,
  ) {
    const rows = await this.prisma.guaranteeClaim.findMany({
      where: query.status ? { status: query.status } : { status: 'OPEN' },
      include: { customer: { select: { phone: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      customerPhone: r.customer.phone,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Post('guarantee-claims/:id/decide')
  @HttpCode(200)
  async decideGuaranteeClaim(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(guaranteeClaimDecisionSchema)) dto: ReturnType<typeof guaranteeClaimDecisionSchema.parse>,
  ) {
    const before = await this.prisma.guaranteeClaim.findUnique({ where: { id } });
    const result = await this.guarantee.decide(id, adminId, dto.approve, dto.resolutionNote);
    await this.audit.record(
      adminId,
      dto.approve ? 'GUARANTEE_CLAIM_APPROVE' : 'GUARANTEE_CLAIM_REJECT',
      'GuaranteeClaim',
      id,
      before ? { status: before.status } : undefined,
      { status: result.status },
    );
    return result;
  }
}
