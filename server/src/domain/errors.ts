/** Erros de aplicação. A camada HTTP traduz `code` em status. */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA'
  | 'NO_SPEECH'
  | 'ENGINE_FAILURE'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} não encontrado(a).`);
export const unauthorized = (message = 'Sessão inválida ou expirada.') =>
  new AppError('UNAUTHORIZED', message);
export const conflict = (message: string) => new AppError('CONFLICT', message);

/** Falha de um motor (transcrição, modelo ou voz), já padronizada pela classe base. */
export class EngineError extends AppError {
  constructor(
    readonly engine: string,
    readonly stage: 'stt' | 'llm' | 'tts',
    message: string,
    options?: { cause?: unknown },
  ) {
    super('ENGINE_FAILURE', message, options);
    this.name = 'EngineError';
  }
}
