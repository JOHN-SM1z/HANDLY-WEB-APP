import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { MasterMediaKind, Prisma } from '@prisma/client';
import type {
  AddressCreate,
  CustomerProfileUpdate,
  MasterAvailabilityDto,
  MasterProfileUpdate,
} from '@handly/contracts';
import { FieldCrypto } from '../../infra/crypto/field-crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldCrypto,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true, masterProfile: true },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      status: user.status,
      locale: user.locale,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      customerProfile: user.customerProfile
        ? { fullName: user.customerProfile.fullName, avatarUrl: user.customerProfile.avatarUrl }
        : null,
      masterProfile: user.masterProfile
        ? {
            fullName: user.masterProfile.fullName,
            verificationStatus: user.masterProfile.verificationStatus,
            trustTier: user.masterProfile.trustTier,
          }
        : null,
    };
  }

  async updateCustomerProfile(userId: string, dto: CustomerProfileUpdate) {
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      update: { fullName: dto.fullName, avatarUrl: dto.avatarUrl },
      create: { userId, fullName: dto.fullName, avatarUrl: dto.avatarUrl },
    });
    return { fullName: profile.fullName, avatarUrl: profile.avatarUrl };
  }

  async getMasterProfile(userId: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
      include: {
        skills: { include: { category: true } },
        serviceAreas: true,
        media: true,
      },
    });
    if (!master) throw new NotFoundException('Usta profili topilmadi');
    return {
      fullName: master.fullName,
      experienceYears: master.experienceYears,
      bio: master.bio,
      verificationStatus: master.verificationStatus,
      trustTier: master.trustTier,
      ratingAvg: Number(master.ratingAvg),
      jobsDone: master.jobsDone,
      isOnline: master.isOnline,
      onlineSince: master.onlineSince?.toISOString() ?? null,
      isSelfEmployed: master.isSelfEmployed,
      pinflSet: master.pinflEncrypted != null,
      skills: master.skills.map((s) => ({
        categoryId: s.categoryId,
        slug: s.category.slug,
        nameUz: s.category.nameUz,
        nameRu: s.category.nameRu,
      })),
      serviceAreas: master.serviceAreas.map((a) => ({
        id: a.id,
        label: a.label,
        centerLat: Number(a.centerLat),
        centerLng: Number(a.centerLng),
        radiusM: a.radiusM,
      })),
      media: master.media.map((m) => ({
        id: m.id,
        kind: m.kind,
        objectKey: m.objectKey,
        caption: m.caption,
        adminApproved: m.adminApproved,
      })),
    };
  }

  /** Real-time online/offline toggle (M3) — the master's own working-hours declaration. */
  async setMasterAvailability(userId: string, isOnline: boolean): Promise<MasterAvailabilityDto> {
    const master = await this.prisma.masterProfile.update({
      where: { userId },
      data: { isOnline, onlineSince: isOnline ? new Date() : null },
    });
    return { isOnline: master.isOnline, onlineSince: master.onlineSince?.toISOString() ?? null };
  }

  async updateMasterProfile(userId: string, dto: MasterProfileUpdate) {
    if (dto.skills.length > 0) {
      const found = await this.prisma.serviceCategory.count({
        where: { id: { in: dto.skills }, active: true },
      });
      if (found !== new Set(dto.skills).size) {
        throw new BadRequestException("Tanlangan xizmat turlaridan biri noto'g'ri");
      }
    }

    const data: Prisma.MasterProfileUpdateInput = {
      fullName: dto.fullName,
      experienceYears: dto.experienceYears,
      bio: dto.bio,
      isSelfEmployed: dto.isSelfEmployed,
    };
    if (dto.pinfl) data.pinflEncrypted = this.crypto.encrypt(dto.pinfl);

    await this.prisma.$transaction(async (tx) => {
      await tx.masterProfile.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          fullName: dto.fullName,
          experienceYears: dto.experienceYears,
          bio: dto.bio,
          isSelfEmployed: dto.isSelfEmployed,
          ...(dto.pinfl ? { pinflEncrypted: this.crypto.encrypt(dto.pinfl) } : {}),
        },
      });

      await tx.masterSkill.deleteMany({ where: { masterId: userId } });
      if (dto.skills.length > 0) {
        await tx.masterSkill.createMany({
          data: dto.skills.map((categoryId) => ({ masterId: userId, categoryId })),
          skipDuplicates: true,
        });
      }

      await tx.serviceArea.deleteMany({ where: { masterId: userId } });
      if (dto.serviceAreas.length > 0) {
        await tx.serviceArea.createMany({
          data: dto.serviceAreas.map((a) => ({
            masterId: userId,
            label: a.label,
            centerLat: a.centerLat,
            centerLng: a.centerLng,
            radiusM: a.radiusM,
          })),
        });
      }
    });

    return this.getMasterProfile(userId);
  }

  // ── Master media (certifications / portfolio) ──
  async addMasterMedia(
    userId: string,
    input: { kind: MasterMediaKind; objectKey: string; caption?: string },
  ) {
    const media = await this.prisma.masterMedia.create({
      data: { masterId: userId, kind: input.kind, objectKey: input.objectKey, caption: input.caption },
    });
    return { id: media.id, kind: media.kind, objectKey: media.objectKey, caption: media.caption };
  }

  async deleteMasterMedia(userId: string, id: string) {
    const media = await this.prisma.masterMedia.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media topilmadi');
    if (media.masterId !== userId) throw new ForbiddenException("Ruxsat yo'q");
    await this.prisma.masterMedia.delete({ where: { id } });
    return { success: true };
  }

  // ── Addresses ──
  async listAddresses(userId: string) {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((a) => ({
      id: a.id,
      label: a.label,
      addressText: a.addressText,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      isDefault: a.isDefault,
    }));
  }

  async createAddress(userId: string, dto: AddressCreate) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      const created = await tx.address.create({
        data: {
          userId,
          label: dto.label,
          addressText: dto.addressText,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault: dto.isDefault,
        },
      });
      return {
        id: created.id,
        label: created.label,
        addressText: created.addressText,
        latitude: Number(created.latitude),
        longitude: Number(created.longitude),
        isDefault: created.isDefault,
      };
    });
  }

  async setDefaultAddress(userId: string, id: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new NotFoundException('Manzil topilmadi');
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { success: true };
  }

  async deleteAddress(userId: string, id: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new NotFoundException('Manzil topilmadi');
    await this.prisma.address.delete({ where: { id } });
    return { success: true };
  }
}
