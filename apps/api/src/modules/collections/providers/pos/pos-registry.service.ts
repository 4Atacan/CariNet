import { Injectable } from '@nestjs/common';
import { AppError, ErrorCode } from '@carinet/shared';
import { SandboxPosAdapter } from './sandbox-pos.adapter';
import { type PosAdapter } from './pos-adapter';

/**
 * §8 — "Adaptorler talep geldikce eklenir." Yeni saglayici = yeni PosAdapter + buraya bir satir.
 * Taninmayan saglayici sessizce gecilemez: satici POS'unu bagladigini sanip para akmamasi
 * en kotu senaryodur.
 */
@Injectable()
export class PosRegistry {
  private readonly adapters: readonly PosAdapter[];

  constructor(sandbox: SandboxPosAdapter) {
    this.adapters = [sandbox];
  }

  /** Panelde POS tanimlanirken secilebilecek saglayicilar. */
  names(): string[] {
    return this.adapters.map((a) => a.name);
  }

  get(provider: string): PosAdapter {
    const adapter = this.adapters.find((a) => a.name === provider.toUpperCase());
    if (!adapter) {
      throw new AppError(
        ErrorCode.POS_NOT_CONFIGURED,
        `Bu odeme saglayicisi icin adaptor yok: ${provider}`,
      );
    }
    return adapter;
  }
}
