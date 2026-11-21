import { describe, expect, it, vi } from 'vitest';
import { FIRST_MAX_CHARS, MAX_CHARS, splitSentences } from '../src/application/speech/sentences.ts';
import { loadConfig } from '../src/config.ts';
import { AppError, EngineError } from '../src/domain/errors.ts';
import { CachedEngineResolver } from '../src/application/LlmResolver.ts';
import { SpeechService } from '../src/application/SpeechService.ts';
import { SqliteDataSource } from '../src/infra/datasource/sqlite/SqliteDataSource.ts';
import { defaultEngineFactory } from '../src/infra/engines/EngineFactory.ts';
import { FakeTtsEngine, silentWav } from '../src/infra/engines/fake/FakeTtsEngine.ts';
import { OpenAiCompatibleTtsEngine } from '../src/infra/engines/openai-compatible/OpenAiCompatibleTtsEngine.ts';

const logger = () => ({ info: vi.fn(), error: vi.fn() });

describe('splitSentences', () => {
  it('divide por pontuação final e mantém a pontuação', () => {
    expect(splitSentences('Interessante. Qual foi o desafio? Me conte mais!')).toEqual([
      'Interessante.',
      'Qual foi o desafio?',
      'Me conte mais!',
    ]);
  });

  it('não corta em abreviações nem em números', () => {
    expect(splitSentences('Fale com o Sr. Silva sobre a versão 3.5 do sistema. Depois me conte.')).toEqual([
      'Fale com o Sr. Silva sobre a versão 3.5 do sistema.',
      'Depois me conte.',
    ]);
  });

  it('junta pedaços muito curtos para não picotar a voz', () => {
    expect(splitSentences('Ok. Vamos à próxima pergunta. Certo?')).toEqual(['Ok. Vamos à próxima pergunta. Certo?']);
  });

  it('quebra frases longas para nenhum trecho passar do limite (evita silêncio entre frases)', () => {
    const longa =
      'Interessante. Qual foi o principal desafio que você enfrentou ao migrar o pipeline de lote para streaming com o Kafka e como você resolveu isso?';
    const parts = splitSentences(longa);
    expect(parts[0]).toBe('Interessante.');
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) expect(p.length, p).toBeLessThanOrEqual(MAX_CHARS);
    expect(parts.join(' ')).toBe(longa); // não perde nem duplica texto
  });

  it('o primeiro trecho é encurtado numa pausa natural, para a voz começar logo', () => {
    const texto = 'Para começar, me conte sobre um projeto recente em que você teve papel central.';
    const parts = splitSentences(texto);
    expect(parts[0]).toBe('Para começar,');
    expect(parts[0]!.length).toBeLessThanOrEqual(FIRST_MAX_CHARS);
    expect(parts.join(' ')).toBe(texto);
  });

  it('sem pausa natural, o primeiro trecho não é picotado no meio da frase', () => {
    expect(splitSentences('Você mencionou que migrou o pipeline para streaming. Qual era o volume?')).toEqual([
      'Você mencionou que migrou o pipeline para streaming.',
      'Qual era o volume?',
    ]);
  });

  it('prefere cortar na vírgula', () => {
    const parts = splitSentences(
      'Quando você liderou a migração, quais critérios usou para escolher entre as duas arquiteturas propostas pelo time?',
    );
    expect(parts[0]).toBe('Quando você liderou a migração,');
  });

  it('texto sem pontuação vira uma parte; vazio vira nenhuma', () => {
    expect(splitSentences('  Pode continuar  ')).toEqual(['Pode continuar']);
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('BaseTtsEngine (template method)', () => {
  it('mede o tempo, registra no log e declara o formato', async () => {
    const log = logger();
    const r = await new FakeTtsEngine(log, { delayMs: 20 }).synthesize({ text: 'Olá.' });
    expect(r).toMatchObject({ engine: 'fake', mimeType: 'audio/wav' });
    expect(r.audio.subarray(0, 4).toString()).toBe('RIFF');
    expect(r.ms).toBeGreaterThanOrEqual(15);
    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ stage: 'tts', engine: 'fake', chars: 4 }), 'tts concluído');
  });

  it('padroniza falha como EngineError e recusa texto vazio sem chamar o fornecedor', async () => {
    const failing = new FakeTtsEngine(logger(), { failWith: new Error('connect ECONNREFUSED') });
    await expect(failing.synthesize({ text: 'Oi.' })).rejects.toMatchObject({ stage: 'tts', code: 'ENGINE_FAILURE' });
    const engine = new FakeTtsEngine(logger());
    await expect(engine.synthesize({ text: '  ' })).rejects.toBeInstanceOf(AppError);
    expect(engine.calls).toHaveLength(0);
  });
});

describe('OpenAiCompatibleTtsEngine', () => {
  const options = {
    name: 'kokoro',
    baseUrl: 'http://127.0.0.1:8880/v1/',
    model: 'kokoro',
    voice: 'pf_dora',
    speed: 1,
    format: 'wav' as const,
    timeoutMs: 5_000,
  };

  it('envia o formato /audio/speech e devolve o áudio com o tipo certo', async () => {
    const wav = silentWav();
    const fetchFn = vi.fn(async () => new Response(new Uint8Array(wav), { headers: { 'content-type': 'audio/wav' } }));
    const r = await new OpenAiCompatibleTtsEngine({ ...options, fetchFn }, logger()).synthesize({ text: 'Olá, tudo bem?' });
    expect(r.mimeType).toBe('audio/wav');
    expect(r.audio.equals(wav)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8880/v1/audio/speech');
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'kokoro',
      input: 'Olá, tudo bem?',
      voice: 'pf_dora',
      response_format: 'wav',
      speed: 1,
    });
  });

  it('serviço fora do ar vira EngineError com dica', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const err = await new OpenAiCompatibleTtsEngine({ ...options, fetchFn }, logger()).synthesize({ text: 'Oi.' }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.message).toContain('serviço de voz');
  });

  it('a factory cria o kokoro com a voz do .env', () => {
    const f = defaultEngineFactory({ config: loadConfig({ TTS_VOICE: 'pm_alex' }), logger: logger() });
    expect(f.createTts()).toBeInstanceOf(OpenAiCompatibleTtsEngine);
    expect(f.ttsNames()).toEqual(['kokoro', 'fake']);
    expect(() => f.createTts('xyz')).toThrow(/TTS_ENGINE "xyz" desconhecido/);
  });
});

describe('SpeechService', () => {
  async function seed(engineSaved: string | null) {
    const ds = new SqliteDataSource(':memory:');
    await ds.init();
    const { users, interviews, messages } = ds.repositories;
    const u = await users.create({ name: 'A', email: 'a@a.com', passwordHash: 'h' });
    const i = await interviews.create({
      userId: u.id, role: 'Dev', company: 'X', level: 'pleno', kind: 'mista', jobDescription: null, resume: null,
      engines: { stt: 'fake', llm: 'fake', tts: engineSaved },
    });
    const [m] = await messages.createMany([
      { interviewId: i.id, author: 'interviewer', content: 'Olá, tudo bem? Vamos começar.', inputMode: null, audioSeconds: null, timings: { sttMs: null, llmMs: 1, ttsMs: null } },
    ]);
    return { ds, userId: u.id, messageId: m!.id };
  }

  it('TTS_ENGINE=none desliga a voz mesmo em entrevista que gravou um motor', async () => {
    const { ds, userId, messageId } = await seed('fake');
    const tts = new FakeTtsEngine(logger());
    const service = new SpeechService(ds.repositories, new CachedEngineResolver(() => tts, 'none'));
    await expect(service.speak(userId, messageId, 0)).rejects.toMatchObject({ code: 'TTS_DISABLED' });
    expect(tts.calls).toHaveLength(0);
    await ds.close();
  });

  it('guarda só o tempo da primeira síntese; "Ouvir de novo" não sobrescreve', async () => {
    const { ds, userId, messageId } = await seed('fake');
    const tts = new FakeTtsEngine(logger());
    const service = new SpeechService(ds.repositories, new CachedEngineResolver(() => tts, 'fake'));
    const first = await service.speak(userId, messageId, 0);
    tts.options.delayMs = 60;
    const again = await service.speak(userId, messageId, 0);
    expect(again.ms).toBeGreaterThanOrEqual(55);
    const found = await ds.repositories.messages.findForUser(messageId, userId);
    expect(found!.message.timings.ttsMs).toBe(first.ms);
    await ds.close();
  });
});
