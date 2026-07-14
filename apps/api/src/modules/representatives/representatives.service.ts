import { Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorCode,
  type CreateRepresentativeInput,
  type UpdateRepresentativeInput,
} from '@carinet/shared';
import { AuditService } from '../../common/audit/audit.service';
import { RepresentativesRepository } from './representatives.repository';

@Injectable()
export class RepresentativesService {
  constructor(
    private readonly repo: RepresentativesRepository,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.repo.findMany();
    return rows.map(({ _count, ...rep }) => ({ ...rep, buyerAccountCount: _count.buyerAccounts }));
  }

  async findOne(id: string) {
    const rep = await this.repo.findById(id);
    if (!rep) throw new AppError(ErrorCode.NOT_FOUND);
    return rep;
  }

  async create(input: CreateRepresentativeInput) {
    const rep = await this.repo.create(input);
    await this.audit.log({
      action: 'CREATE',
      entity: 'Representative',
      entityId: rep.id,
      after: rep,
    });
    return rep;
  }

  async update(id: string, input: UpdateRepresentativeInput) {
    const before = await this.findOne(id);
    const after = await this.repo.update(id, input);
    await this.audit.log({
      action: 'UPDATE',
      entity: 'Representative',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  async remove(id: string) {
    const before = await this.findOne(id);
    await this.repo.delete(id);
    await this.audit.log({ action: 'DELETE', entity: 'Representative', entityId: id, before });
    return { id };
  }
}
