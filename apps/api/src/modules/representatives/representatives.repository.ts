import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PRISMA, type PrismaService } from '../../prisma/prisma.module';

/** Kural #3: seller_id filtresi ELLE yazilmaz — tenant eklentisi enjekte eder. */
@Injectable()
export class RepresentativesRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  findMany() {
    return this.prisma.representative.findMany({
      orderBy: { fullName: 'asc' },
      include: { _count: { select: { buyerAccounts: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.representative.findFirst({ where: { id } });
  }

  create(data: Omit<Prisma.RepresentativeUncheckedCreateInput, 'sellerId'>) {
    return this.prisma.representative.create({
      data: data as Prisma.RepresentativeUncheckedCreateInput,
    });
  }

  update(id: string, data: Prisma.RepresentativeUncheckedUpdateInput) {
    return this.prisma.representative.update({ where: { id }, data });
  }

  /** Temsilci finansal kayit degildir → hard delete serbest (kural #4). Carilerde SetNull. */
  delete(id: string) {
    return this.prisma.representative.delete({ where: { id } });
  }
}
