import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../../ports/security.ts';

/** Argon2id com os parâmetros padrão da biblioteca (recomendados pela OWASP). */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string) {
    return hash(plain);
  }

  async verify(hashed: string, plain: string) {
    try {
      return await verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
