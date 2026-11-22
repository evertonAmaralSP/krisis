/**
 * Cliente da API v1. Os tipos vêm do pacote de contratos: se o contrato muda,
 * o frontend deixa de compilar onde for afetado.
 */
import { v1 } from '@krisis/contracts';

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
      // FormData: o navegador define o content-type com o boundary do multipart.
      headers: body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : undefined,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
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

export interface SpeechChunk {
  blob: Blob;
  parts: number;
  ms: number;
}

/** Áudio binário: não passa pelo request() de JSON. */
async function fetchSpeech(messageId: string, part: number, voice?: string): Promise<SpeechChunk> {
  let res: Response;
  try {
    const voiceParam = voice ? `&voice=${encodeURIComponent(voice)}` : '';
    res = await fetch(`${BASE}/messages/${encodeURIComponent(messageId)}/speech?part=${part}${voiceParam}`, {
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Não foi possível falar com o servidor.');
  }
  if (!res.ok) {
    const err = ((await res.json().catch(() => null)) as v1.ErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `Erro ${res.status}.`);
  }
  return {
    blob: await res.blob(),
    parts: Number(res.headers.get(v1.SPEECH_PARTS_HEADER) ?? 1),
    ms: Number(res.headers.get(v1.SPEECH_MS_HEADER) ?? 0),
  };
}

export const api = {
  speech: fetchSpeech,
  voices: () => request<v1.VoiceList>('GET', '/speech/voices'),
  voiceSample: async (voice: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/speech/voices/${encodeURIComponent(voice)}/sample`, { credentials: 'same-origin' });
    if (!res.ok) {
      const err = ((await res.json().catch(() => null)) as v1.ErrorBody | null)?.error;
      throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `Erro ${res.status}.`);
    }
    return res.blob();
  },
  account: () => request<v1.Account>('GET', '/account'),
  updateAccount: (body: v1.UpdateAccountBody) => request<v1.Account>('PATCH', '/account', body),
  changePassword: (body: v1.ChangePasswordBody) => request<void>('POST', '/account/password', body),
  deleteInterview: (id: string) => request<void>('DELETE', `/interviews/${encodeURIComponent(id)}`),
  finishInterview: (id: string) => request<v1.Feedback>('POST', `/interviews/${encodeURIComponent(id)}/finish`),
  feedback: (id: string) => request<v1.Feedback>('GET', `/interviews/${encodeURIComponent(id)}/feedback`),
  login: (body: v1.LoginBody) => request<v1.MeResponse>('POST', '/auth/login', body),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<v1.MeResponse>('GET', '/auth/me'),
  listInterviews: () => request<v1.InterviewList>('GET', '/interviews'),
  createInterview: (body: v1.CreateInterviewBody) => request<v1.Interview>('POST', '/interviews', body),
  getInterview: (id: string) => request<v1.Interview>('GET', `/interviews/${encodeURIComponent(id)}`),
  transcribe: async (id: string, audio: Blob, filename: string): Promise<v1.TranscriptionResponse> => {
    const form = new FormData();
    form.append('audio', audio, filename);
    return request<v1.TranscriptionResponse>('POST', `/interviews/${encodeURIComponent(id)}/transcriptions`, form);
  },
  sendMessage: (id: string, body: v1.SendMessageBody) =>
    request<v1.SendMessageResponse>('POST', `/interviews/${encodeURIComponent(id)}/messages`, body),
};
