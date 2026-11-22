/**
 * Configuração lida do ambiente e validada na partida.
 * O .env fica na raiz do monorepo; variáveis já definidas no ambiente têm prioridade.
 */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  COOKIE_SECURE: bool,
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  DB_DRIVER: z.string().default('sqlite'),
  SQLITE_PATH: z.string().default('data/krisis.db'),

  ADMIN_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
  ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
  ADMIN_PASSWORD_HASH: z.preprocess(emptyToUndefined, z.string().startsWith('$argon2').optional()),

  LLM_ENGINE: z.string().default('groq'),
  LLM_MODEL: z.string().default('openai/gpt-oss-20b'),
  LLM_REASONING_EFFORT: z.preprocess(emptyToUndefined, z.enum(['low', 'medium', 'high']).optional()),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  STT_ENGINE: z.string().default('groq'),
  STT_MODEL: z.string().default('whisper-large-v3-turbo'),
  STT_LANGUAGE: z.string().default('pt'),
  STT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  TTS_ENGINE: z.string().default('kokoro'),
  TTS_MODEL: z.string().default('kokoro'),
  TTS_VOICE: z.string().default('pf_dora'),
  /** Vozes oferecidas para comparar na tela (separadas por vírgula). */
  TTS_VOICES: z.string().default('pf_dora,pm_alex,pm_santa'),
  TTS_SPEED: z.coerce.number().min(0.5).max(2).default(1),
  TTS_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  KOKORO_BASE_URL: z.url().default('http://127.0.0.1:8880/v1'),

  GROQ_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GROQ_BASE_URL: z.url().default('https://api.groq.com/openai/v1'),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida no .env:\n${issues}`);
  }
  const e = parsed.data;
  const sqlitePath =
    e.SQLITE_PATH === ':memory:' || isAbsolute(e.SQLITE_PATH)
      ? e.SQLITE_PATH
      : resolve(REPO_ROOT, e.SQLITE_PATH);

  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    session: { ttlDays: e.SESSION_TTL_DAYS, cookieSecure: e.COOKIE_SECURE },
    db: { driver: e.DB_DRIVER, sqlitePath },
    admin: { name: e.ADMIN_NAME, email: e.ADMIN_EMAIL, passwordHash: e.ADMIN_PASSWORD_HASH },
    llm: {
      engine: e.LLM_ENGINE,
      model: e.LLM_MODEL,
      reasoningEffort: e.LLM_REASONING_EFFORT,
      maxTokens: e.LLM_MAX_TOKENS,
      timeoutMs: e.LLM_TIMEOUT_MS,
    },
    stt: {
      engine: e.STT_ENGINE,
      model: e.STT_MODEL,
      language: e.STT_LANGUAGE,
      timeoutMs: e.STT_TIMEOUT_MS,
    },
    tts: {
      /** "none" desliga a voz: o chat continua só com texto. */
      engine: e.TTS_ENGINE,
      model: e.TTS_MODEL,
      voice: e.TTS_VOICE,
      voices: e.TTS_VOICES.split(',').map((v) => v.trim()).filter(Boolean),
      speed: e.TTS_SPEED,
      timeoutMs: e.TTS_TIMEOUT_MS,
    },
    kokoro: { baseUrl: e.KOKORO_BASE_URL },
    groq: { apiKey: e.GROQ_API_KEY, baseUrl: e.GROQ_BASE_URL },
  };
}

/** Carrega o .env da raiz, se existir, sem sobrescrever o ambiente. */
export function loadDotEnv(path = resolve(REPO_ROOT, '.env')) {
  if (existsSync(path)) process.loadEnvFile(path);
}
