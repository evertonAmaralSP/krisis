import { AppError, notFound } from '../domain/errors.ts';
import type { User } from '../domain/types.ts';
import type { Repositories } from '../ports/repositories.ts';
import type { PasswordHasher } from '../ports/security.ts';

export interface AccountPatch {
  name?: string | undefined;
  email?: string | undefined;
  currentPassword?: string | undefined;
  ttsVoice?: string | null | undefined;
}

const wrongPassword = () => new AppError('INVALID_PASSWORD', 'Senha atual incorreta.');

/** Nome, e-mail, senha e voz preferida da conta. */
export class AccountService {
  constructor(
    private readonly repos: Repositories,
    private readonly hasher: PasswordHasher,
    /** Vozes aceitas como preferência (as mesmas oferecidas na tela). */
    private readonly availableVoices: () => string[],
  ) {}

  async get(userId: string): Promise<User> {
    const user = await this.repos.users.findById(userId);
    if (!user) throw notFound('Usuário');
    return user;
  }

  async update(userId: string, patch: AccountPatch): Promise<User> {
    const user = await this.get(userId);
    const changes: Partial<Pick<User, 'name' | 'email' | 'ttsVoice'>> = {};

    if (patch.name !== undefined && patch.name !== user.name) changes.name = patch.name;

    if (patch.email !== undefined && patch.email.toLowerCase() !== user.email) {
      // O e-mail é o login: trocar exige a senha, para uma sessão aberta não tomar a conta.
      if (!patch.currentPassword) {
        throw new AppError('BAD_REQUEST', 'Para trocar o e-mail, informe a senha atual.');
      }
      if (!(await this.hasher.verify(user.passwordHash, patch.currentPassword))) throw wrongPassword();
      const taken = await this.repos.users.findByEmail(patch.email);
      if (taken && taken.id !== user.id) throw new AppError('CONFLICT', 'Este e-mail já está em uso.');
      changes.email = patch.email;
    }

    if (patch.ttsVoice !== undefined) {
      if (patch.ttsVoice !== null && !this.availableVoices().includes(patch.ttsVoice)) {
        throw new AppError('BAD_REQUEST', `Voz não disponível: ${patch.ttsVoice}.`);
      }
      changes.ttsVoice = patch.ttsVoice;
    }

    if (Object.keys(changes).length === 0) return user;
    return this.repos.users.update(user.id, changes);
  }

  /** Troca a senha e encerra todas as outras sessões; a atual continua. */
  async changePassword(userId: string, keepSessionId: string, currentPassword: string, newPassword: string) {
    const user = await this.get(userId);
    if (!(await this.hasher.verify(user.passwordHash, currentPassword))) throw wrongPassword();
    if (currentPassword === newPassword) {
      throw new AppError('BAD_REQUEST', 'A nova senha precisa ser diferente da atual.');
    }
    await this.repos.users.update(user.id, { passwordHash: await this.hasher.hash(newPassword) });
    await this.repos.sessions.deleteAllForUserExcept(user.id, keepSessionId);
  }
}
