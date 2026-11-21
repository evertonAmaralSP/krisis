/**
 * Redefine a senha direto no banco e encerra todas as sessões.
 * É a recuperação de acesso: exige acesso à máquina onde o portal roda.
 * Rode com: npm run reset-password  (ou: npm run reset-password -- --email voce@exemplo.com)
 */
import { loadConfig, loadDotEnv } from '../config.ts';
import { defaultDataSourceFactory } from '../infra/datasource/DataSourceFactory.ts';
import { Argon2PasswordHasher } from '../infra/security/Argon2PasswordHasher.ts';
import { askNewPassword } from './prompt.ts';

loadDotEnv();
const config = loadConfig();
const dataSource = defaultDataSourceFactory().create(config);

try {
  await dataSource.init();
  const { users, sessions } = dataSource.repositories;
  const emailArg = process.argv.indexOf('--email');
  const email = emailArg > -1 ? process.argv[emailArg + 1] : config.admin.email;
  if (!email) throw new Error('Informe o e-mail: npm run reset-password -- --email voce@exemplo.com');

  const user = await users.findByEmail(email);
  if (!user) throw new Error(`Nenhum usuário com o e-mail ${email}.`);

  const password = await askNewPassword();
  await users.update(user.id, { passwordHash: await new Argon2PasswordHasher().hash(password) });
  await sessions.deleteAllForUserExcept(user.id, null);
  console.log(`Senha de ${user.email} redefinida. Todas as sessões foram encerradas.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await dataSource.close();
}
