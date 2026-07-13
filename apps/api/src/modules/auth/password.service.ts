import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** §11.1 — argon2id. Parametreler OWASP asgarisi (19 MiB, t=2, p=1). */
const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
