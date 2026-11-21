import { createHash, randomBytes } from 'node:crypto';
import type { User } from '../domain/types.ts';
import { unauthorized } from '../domain/errors.ts';
import type { Repositories } from '../ports/repositories.ts';
import type { PasswordHasher } from '../ports/security.ts';

export interface AuthLogger {
  info(msg: string): void;
  warn(msg: string): void;
}

/** O banco guarda só o hash do token; o token puro vive apenas no cookie. */
export const sessionIdFromToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly repos: Repositories,
    private readonly hasher: PasswordHasher,
    private readonly sessionTtlDays: number,
  ) {}

  /**
   * Primeiro uso: se o banco não tem usuário, cria a conta a partir do .env.
   * Depois disso o banco é a fonte da verdade e as variáveis são ignoradas.
   */
  async bootstrapAdmin(
    admin: { name?: string | undefined; email?: string | undefined; passwordHash?: string | undefined },
    log: AuthLogger,
  ): Promise<void> {
    if ((await this.repos.users.count()) > 0) return;
    if (!admin.email || !admin.passwordHash) {
      log.warn(
        'Nenhum usuário no banco. Defina ADMIN_EMAIL e ADMIN_PASSWORD_HASH no .env e reinicie (gere o hash com: npm run hash-password).',
      );
      return;
    }
    await this.repos.users.create({
      name: admin.name ?? 'Você',
      email: admin.email,
      passwordHash: admin.passwordHash,
    });
    log.info(`Conta inicial criada para ${admin.email}.`);
  }

  async login(email: string, password: string): Promise<{ token: string; user: User; expiresAt: Date }> {
    const user = await this.repos.users.findByEmail(email);
    // Mesmo sem usuário, roda uma verificação para não revelar pelo tempo se o e-mail existe.
    const ok = user
      ? await this.hasher.verify(user.passwordHash, password)
      : (await this.hasher.verify(await this.getDummyHash(), password), false);
    if (!user || !ok) throw unauthorized('E-mail ou senha incorretos.');

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlDays * 86_400_000);
    await this.repos.sessions.deleteExpired(now);
    await this.repos.sessions.create({
      id: sessionIdFromToken(token),
      userId: user.id,
      expiresAt,
      createdAt: now,
    });
    return { token, user, expiresAt };
  }

  /** Devolve o usuário da sessão, ou null se o token for inválido ou expirado. */
  async authenticate(token: string | undefined): Promise<{ user: User; sessionId: string } | null> {
    if (!token) return null;
    const sessionId = sessionIdFromToken(token);
    const session = await this.repos.sessions.findValid(sessionId, new Date());
    if (!session) return null;
    const user = await this.repos.users.findById(session.userId);
    return user ? { user, sessionId } : null;
  }

  async logout(sessionId: string): Promise<void> {
    await this.repos.sessions.delete(sessionId);
  }

  private getDummyHash() {
    this.dummyHash ??= this.hasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
