import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { guaranteeClaimDecisionSchema, verificationDecisionSchema } from '@handly/contracts';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { GuaranteeService } from '../guarantee/guarantee.service';
import { VerificationService } from '../verification/verification.service';

/**
 * Admin-ready decision endpoints (Batch 2) — API only, no dashboard UI yet
 * (that's Batch 3). Exists so the verification/guarantee lifecycles are real,
 * not just modeled, ahead of a proper admin surface.
 */
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly verification: VerificationService,
    private readonly guarantee: GuaranteeService,
  ) {}

  @Post('verifications/:id/decide')
  @HttpCode(200)
  decideVerification(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(verificationDecisionSchema)) dto: ReturnType<typeof verificationDecisionSchema.parse>,
  ) {
    return this.verification.decide(id, adminId, dto.approve, dto.note);
  }

  @Post('guarantee-claims/:id/decide')
  @HttpCode(200)
  decideGuaranteeClaim(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(guaranteeClaimDecisionSchema)) dto: ReturnType<typeof guaranteeClaimDecisionSchema.parse>,
  ) {
    return this.guarantee.decide(id, adminId, dto.approve, dto.resolutionNote);
  }
}
