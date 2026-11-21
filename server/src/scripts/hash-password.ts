/** Gera o hash argon2 para ADMIN_PASSWORD_HASH. Rode com: npm run hash-password */
import { Argon2PasswordHasher } from '../infra/security/Argon2PasswordHasher.ts';
import { askNewPassword } from './prompt.ts';

try {
  const password = await askNewPassword();
  const hash = await new Argon2PasswordHasher().hash(password);
  console.log('\nCopie a linha abaixo para o .env (com as aspas simples):\n');
  console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
