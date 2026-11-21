import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from '../../domain/errors.ts';
import type { User } from '../../domain/types.ts';
import type { AuthService } from '../../application/AuthService.ts';

export const SESSION_COOKIE = 'krisis_sid';

declare module 'fastify' {
  interface FastifyRequest {
    auth: { user: User; sessionId: string } | null;
  }
}

/** Usuário autenticado da requisição. Só chame dentro de rotas protegidas. */
export function currentUser(request: FastifyRequest): User {
  if (!request.auth) throw unauthorized();
  return request.auth.user;
}

/**
 * Hook das rotas protegidas. Hoje lê o cookie de sessão; quando o MCP chegar,
 * passa a aceitar também `Authorization: Bearer`.
 */
export const requireSession =
  (auth: AuthService) => async (request: FastifyRequest, _reply: FastifyReply) => {
    request.auth = await auth.authenticate(request.cookies[SESSION_COOKIE]);
    if (!request.auth) throw unauthorized();
  };
