import { describe, expect, it, vi } from 'vitest';
import { CachedEngineResolver } from '../src/application/LlmResolver.ts';
import { looksLikeNoSpeech } from '../src/application/TranscriptionService.ts';
import { loadConfig } from '../src/config.ts';
import { AppError, EngineError } from '../src/domain/errors.ts';
import { defaultEngineFactory } from '../src/infra/engines/EngineFactory.ts';
import { FakeSttEngine } from '../src/infra/engines/fake/FakeSttEngine.ts';
import {
  extensionFor,
  OpenAiCompatibleSttEngine,
} from '../src/infra/engines/openai-compatible/OpenAiCompatibleSttEngine.ts';

const logger = () => ({ info: vi.fn(), error: vi.fn() });
const audio = Buffer.from('audio-falso');

describe('BaseSttEngine (template method)', () => {
  it('mede o tempo, registra no log e apara o texto', async () => {
    const log = logger();
    const engine = new FakeSttEngine(log, { text: '  minha resposta  ', delayMs: 20 });
    const r = await engine.transcribe({ audio, mimeType: 'audio/webm' });
    expect(r).toMatchObject({ text: 'minha resposta', engine: 'fake', model: 'fake-stt-1' });
    expect(r.ms).toBeGreaterThanOrEqual(15);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'stt', engine: 'fake', ms: r.ms, bytes: audio.length }),
      'stt concluído',
    );
  });

  it('padroniza falha do fornecedor como EngineError', async () => {
    const engine = new FakeSttEngine(logger(), { failWith: new Error('fora do ar') });
    const err = await engine.transcribe({ audio, mimeType: 'audio/webm' }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err).toMatchObject({ stage: 'stt', engine: 'fake' });
  });

  it('recusa áudio vazio sem chamar o fornecedor', async () => {
    const engine = new FakeSttEngine(logger());
    await expect(engine.transcribe({ audio: Buffer.alloc(0), mimeType: 'audio/webm' })).rejects.toBeInstanceOf(
      AppError,
    );
    expect(engine.calls).toHaveLength(0);
  });
});

describe('OpenAiCompatibleSttEngine', () => {
  const options = {
    name: 'groq',
    baseUrl: 'https://api.exemplo.com/openai/v1',
    apiKey: 'chave-falsa',
    model: 'whisper-x',
    language: 'pt',
    timeoutMs: 5_000,
  };

  it('envia multipart para /audio/transcriptions com idioma, contexto e extensão certa', async () => {
    const fetchFn = vi.fn(async () => Response.json({ text: 'Olá, tudo bem.' }));
    const engine = new OpenAiCompatibleSttEngine({ ...options, fetchFn }, logger());
    const r = await engine.transcribe({ audio, mimeType: 'audio/webm;codecs=opus', prompt: 'Vaga de dados.' });

    expect(r).toMatchObject({ text: 'Olá, tudo bem.', model: 'whisper-x', engine: 'groq' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.exemplo.com/openai/v1/audio/transcriptions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer chave-falsa');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-x');
    expect(form.get('language')).toBe('pt');
    expect(form.get('response_format')).toBe('json');
    expect(form.get('prompt')).toBe('Vaga de dados.');
    const file = form.get('file') as File;
    expect(file.name).toBe('fala.webm');
    expect(file.type).toBe('audio/webm');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(audio);
  });

  it('transforma erro HTTP em EngineError', async () => {
    const fetchFn = vi.fn(async () => new Response('arquivo inválido', { status: 400 }));
    const engine = new OpenAiCompatibleSttEngine({ ...options, fetchFn }, logger());
    const err = await engine.transcribe({ audio, mimeType: 'audio/webm' }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(String(err.cause)).toContain('400');
  });

  it('mapeia o tipo gravado pelo navegador para a extensão', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionFor('audio/mp4')).toBe('mp4');
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg');
    expect(extensionFor('audio/x-wav')).toBe('wav');
  });
});

describe('EngineFactory (transcrição)', () => {
  const ctx = (env: Record<string, string> = {}) => ({ config: loadConfig({ NODE_ENV: 'test', ...env }), logger: logger() });

  it('cria pelo nome, usa STT_ENGINE como padrão e explica nomes desconhecidos', () => {
    expect(defaultEngineFactory(ctx({ STT_ENGINE: 'fake' })).createStt().name).toBe('fake');
    expect(defaultEngineFactory(ctx({ GROQ_API_KEY: 'x' })).createStt('groq')).toBeInstanceOf(OpenAiCompatibleSttEngine);
    expect(() => defaultEngineFactory(ctx()).createStt('xyz')).toThrow(/STT_ENGINE "xyz" desconhecido. Disponíveis: groq, fake/);
  });
});

describe('looksLikeNoSpeech', () => {
  it('reconhece silêncio e alucinações conhecidas', () => {
    for (const t of ['', '   ', '...', 'Legendas pela comunidade Amara.org', ' Obrigado por assistir! ', 'Thank you.', 'E aí']) {
      expect(looksLikeNoSpeech(t), JSON.stringify(t)).toBe(true);
    }
  });

  it('aceita fala real, inclusive curta', () => {
    for (const t of ['Obrigado.', 'Sim.', 'Trabalhei cinco anos com dados.', 'Tchau, até mais.']) {
      expect(looksLikeNoSpeech(t), t).toBe(false);
    }
  });
});

describe('CachedEngineResolver', () => {
  it('motor gravado que não pode ser criado vira ENGINE_FAILURE (502), não erro interno', () => {
    const resolver = new CachedEngineResolver<unknown>((name) => {
      throw new Error(`STT_ENGINE "${name}" desconhecido.`);
    }, 'fake');
    let err: unknown;
    try {
      resolver.get('antigo');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'ENGINE_FAILURE' });
    expect((err as Error).message).toContain('"antigo"');
  });

  it('cria cada motor uma vez por nome', () => {
    const create = vi.fn((name: string) => ({ name }));
    const resolver = new CachedEngineResolver(create, 'a');
    expect(resolver.get('a')).toBe(resolver.get('a'));
    expect(create).toHaveBeenCalledTimes(1);
  });
});
