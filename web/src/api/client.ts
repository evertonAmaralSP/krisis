/**
 * Cliente da API v1. Os tipos vêm do pacote de contratos: se o contrato muda,
 * o frontend deixa de compilar onde for afetado.
 */
import type { v1 } from '@krisis/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE = '/api/v1';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Não foi possível falar com o servidor. Ele está rodando?');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as v1.ErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `Erro ${res.status}.`);
  }
  return data as T;
}

export const api = {
  login: (body: v1.LoginBody) => request<v1.MeResponse>('POST', '/auth/login', body),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<v1.MeResponse>('GET', '/auth/me'),
  listInterviews: () => request<v1.InterviewList>('GET', '/interviews'),
  createInterview: (body: v1.CreateInterviewBody) => request<v1.Interview>('POST', '/interviews', body),
  getInterview: (id: string) => request<v1.Interview>('GET', `/interviews/${encodeURIComponent(id)}`),
  sendMessage: (id: string, body: v1.SendMessageBody) =>
    request<v1.SendMessageResponse>('POST', `/interviews/${encodeURIComponent(id)}/messages`, body),
};
