import { Injectable } from '@nestjs/common';
import type { AccountProvider as PrismaAccountProvider } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { AccountProvider, AccountProviderId } from '../../domain/entities/account-provider';
import type { OAuthProvider } from '../../domain/value-objects/oauth-profile';
import type { IAccountProviderRepository } from '../../domain/ports/account-provider.repository';

@Injectable()
export class PrismaAccountProviderRepository implements IAccountProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<AccountProvider | null> {
    const row = await this.prisma.accountProvider.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAllForUser(userId: string): Promise<AccountProvider[]> {
    const rows = await this.prisma.accountProvider.findMany({ where: { userId } });
    return rows.map((r) => this.toDomain(r));
  }

  async save(link: AccountProvider): Promise<void> {
    const s = link.toSnapshot();
    await this.prisma.accountProvider.upsert({
      where: { id: s.id.value },
      create: {
        id: s.id.value,
        userId: s.userId,
        provider: s.provider,
        providerAccountId: s.providerAccountId,
        createdAt: s.createdAt,
      },
      update: {},
    });
  }

  private toDomain(row: PrismaAccountProvider): AccountProvider {
    return AccountProvider.rehydrate({
      id: AccountProviderId.of(row.id),
      userId: row.userId,
      provider: row.provider as OAuthProvider,
      providerAccountId: row.providerAccountId,
      createdAt: row.createdAt,
    });
  }
}
