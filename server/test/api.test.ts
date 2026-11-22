import { afterEach, describe, expect, it } from 'vitest';
import { buildInMemoryApp, TEST_USER } from '../src/testing/inMemoryApp.ts';
import type { FakeLlmOptions } from '../src/infra/engines/fake/FakeLlmEngine.ts';

type Ctx = Awaited<ReturnType<typeof buildInMemoryApp>>;
let ctx: Ctx | null = null;
afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

async function start(llm: FakeLlmOptions = {}) {
  ctx = await buildInMemoryApp(llm);
  return ctx;
}

async function login(c: Ctx) {
  const res = await c.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: TEST_USER.email, password: TEST_USER.password },
  });
  expect(res.statusCode).toBe(200);
  const cookie = res.cookies.find((k) => k.name === 'krisis_sid');
  expect(cookie?.httpOnly).toBe(true);
  return { cookie: `krisis_sid=${cookie!.value}` };
}

const novaEntrevista = { role: 'Engenheiro de dados', company: 'Empresa X', level: 'senior', kind: 'tecnica' };

describe('Autenticação', () => {
  it('recusa senha errada sem dizer se o e-mail existe', async () => {
    const c = await start();
    for (const email of [TEST_USER.email, 'ninguem@exemplo.com']) {
      const res = await c.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: 'errada' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.message).toBe('E-mail ou senha incorretos.');
    }
  });

  it('exige sessão em todas as rotas exceto o login', async () => {
    const c = await start();
    for (const [method, url] of [
      ['GET', '/api/v1/auth/me'],
      ['GET', '/api/v1/interviews'],
      ['POST', '/api/v1/interviews'],
      ['POST', '/api/v1/auth/logout'],
    ] as const) {
      const res = await c.app.inject({ method, url, payload: method === 'POST' ? {} : undefined });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('login → me → logout invalida a sessão', async () => {
    const c = await start();
    const headers = await login(c);
    const me = await c.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers });
    expect(me.json()).toEqual({ user: expect.objectContaining({ email: TEST_USER.email, name: TEST_USER.name }) });
    expect(me.body).not.toContain('passwordHash');

    expect((await c.app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers })).statusCode).toBe(204);
    expect((await c.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers })).statusCode).toBe(401);
  });
});

describe('Entrevista por texto', () => {
  it('cria a entrevista já com a primeira pergunta e conversa com histórico', async () => {
    const c = await start({ replies: ['Primeira pergunta?', 'Segunda pergunta?'] });
    const headers = await login(c);

    const created = await c.app.inject({ method: 'POST', url: '/api/v1/interviews', headers, payload: novaEntrevista });
    expect(created.statusCode).toBe(201);
    const interview = created.json();
    expect(interview.engines).toEqual({ stt: 'fake', llm: 'fake', tts: 'fake' });
    expect(interview.messages).toHaveLength(1);
    expect(interview.messages[0]).toMatchObject({ author: 'interviewer', content: 'Primeira pergunta?' });
    expect(interview.messages[0].timings.llmMs).toBeTypeOf('number');

    const turn = await c.app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${interview.id}/messages`,
      headers,
      payload: { content: 'Minha resposta.' },
    });
    expect(turn.statusCode).toBe(200);
    expect(turn.json()).toMatchObject({
      candidateMessage: { author: 'candidate', content: 'Minha resposta.', inputMode: 'text' },
      interviewerMessage: { author: 'interviewer', content: 'Segunda pergunta?' },
    });

    // O modelo recebeu instruções com a vaga + todo o histórico, na ordem.
    const sent = c.llm.calls[1]!.messages;
    expect(sent[0]!.role).toBe('system');
    expect(sent[0]!.content).toContain('Engenheiro de dados');
    expect(sent.slice(1)).toEqual([
      { role: 'assistant', content: 'Primeira pergunta?' },
      { role: 'user', content: 'Minha resposta.' },
    ]);

    const full = await c.app.inject({ method: 'GET', url: `/api/v1/interviews/${interview.id}`, headers });
    expect(full.json().messages.map((m: { content: string }) => m.content)).toEqual([
      'Primeira pergunta?',
      'Minha resposta.',
      'Segunda pergunta?',
    ]);
    const list = await c.app.inject({ method: 'GET', url: '/api/v1/interviews', headers });
    expect(list.json().items).toHaveLength(1);
  });

  it('se o modelo falhar, responde 502 e não grava nada', async () => {
    const c = await start({ replies: ['Primeira pergunta?'] });
    const headers = await login(c);
    const interview = (await c.app.inject({ method: 'POST', url: '/api/v1/interviews', headers, payload: novaEntrevista })).json();

    (c.llm as unknown as { options: FakeLlmOptions }).options.failWith = new Error('fora do ar');
    const turn = await c.app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${interview.id}/messages`,
      headers,
      payload: { content: 'Resposta.' },
    });
    expect(turn.statusCode).toBe(502);
    expect(turn.json().error.code).toBe('ENGINE_FAILURE');
    const full = await c.app.inject({ method: 'GET', url: `/api/v1/interviews/${interview.id}`, headers });
    expect(full.json().messages).toHaveLength(1);
  });

  it('valida a entrada pelo contrato', async () => {
    const c = await start();
    const headers = await login(c);
    const res = await c.app.inject({
      method: 'POST',
      url: '/api/v1/interviews',
      headers,
      payload: { ...novaEntrevista, level: 'estagiario' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
  });

  it('entrevista inexistente devolve 404', async () => {
    const c = await start();
    const headers = await login(c);
    const res = await c.app.inject({ method: 'GET', url: '/api/v1/interviews/nao-existe', headers });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/v1/messages/{id}/speech', () => {
  type Ctx = Awaited<ReturnType<typeof buildInMemoryApp>>;
  let ctx: Ctx | null = null;
  afterEach(async () => {
    await ctx?.close();
    ctx = null;
  });

  async function setup(tts: Parameters<typeof buildInMemoryApp>[2] = {}) {
    ctx = await buildInMemoryApp(
      { replies: ['Interessante. Qual foi o maior desafio técnico? Me conte com detalhes.', 'Segunda.'] },
      {},
      tts,
    );
    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: TEST_USER.email, password: TEST_USER.password },
    });
    const cookie = `krisis_sid=${login.cookies.find((k) => k.name === 'krisis_sid')!.value}`;
    const interview = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/interviews',
        headers: { cookie },
        payload: { role: 'Dev', company: 'X', level: 'pleno', kind: 'mista' },
      })
    ).json();
    return { c: ctx, cookie, interview, messageId: interview.messages[0].id as string };
  }

  it('devolve cada frase como WAV, diz quantas são e grava o tempo da primeira', async () => {
    const { c, cookie, interview, messageId } = await setup();
    const parts: string[] = [];
    for (let part = 0; part < 3; part++) {
      const res = await c.app.inject({ method: 'GET', url: `/api/v1/messages/${messageId}/speech?part=${part}`, headers: { cookie } });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('audio/wav');
      expect(res.headers['x-speech-parts']).toBe('3');
      expect(Number(res.headers['x-tts-ms'])).toBeGreaterThanOrEqual(0);
      expect(res.rawPayload.subarray(0, 4).toString()).toBe('RIFF');
      parts.push(c.tts.calls[part]!.text);
    }
    expect(parts).toEqual(['Interessante.', 'Qual foi o maior desafio técnico?', 'Me conte com detalhes.']);

    const after = await c.app.inject({ method: 'GET', url: `/api/v1/interviews/${interview.id}`, headers: { cookie } });
    expect(after.json().messages[0].timings.ttsMs).toBeTypeOf('number');

    const beyond = await c.app.inject({ method: 'GET', url: `/api/v1/messages/${messageId}/speech?part=3`, headers: { cookie } });
    expect(beyond.statusCode).toBe(404);
  });

  it('lista as vozes e toca a mesma frase em outra voz sem mexer no tempo gravado', async () => {
    const { c, cookie, interview, messageId } = await setup();
    const voices = await c.app.inject({ method: 'GET', url: '/api/v1/speech/voices', headers: { cookie } });
    expect(voices.json()).toEqual({
      default: 'pf_dora',
      voices: [
        { id: 'pf_dora', label: 'Dora (feminina)' },
        { id: 'pm_alex', label: 'Alex (masculina)' },
        { id: 'pm_santa', label: 'Santa (masculina)' },
      ],
    });

    const alt = await c.app.inject({ method: 'GET', url: `/api/v1/messages/${messageId}/speech?part=0&voice=pm_alex`, headers: { cookie } });
    expect(alt.statusCode).toBe(200);
    expect(c.tts.calls.at(-1)).toEqual({ text: 'Interessante.', voice: 'pm_alex' });
    const after = await c.app.inject({ method: 'GET', url: `/api/v1/interviews/${interview.id}`, headers: { cookie } });
    expect(after.json().messages[0].timings.ttsMs).toBeNull(); // comparação não conta como a espera real

    const bad = await c.app.inject({ method: 'GET', url: `/api/v1/messages/${messageId}/speech?voice=xx_nada`, headers: { cookie } });
    expect(bad.statusCode).toBe(400);
  });

  it('fala do candidato não tem voz; mensagem inexistente ou sem sessão não passa', async () => {
    const { c, cookie, interview } = await setup();
    const turn = await c.app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${interview.id}/messages`,
      headers: { cookie },
      payload: { content: 'Minha resposta.' },
    });
    const candidateId = turn.json().candidateMessage.id;
    expect((await c.app.inject({ method: 'GET', url: `/api/v1/messages/${candidateId}/speech`, headers: { cookie } })).statusCode).toBe(400);
    expect((await c.app.inject({ method: 'GET', url: '/api/v1/messages/nao-existe/speech', headers: { cookie } })).statusCode).toBe(404);
    expect((await c.app.inject({ method: 'GET', url: `/api/v1/messages/${candidateId}/speech` })).statusCode).toBe(401);
  });

  it('com TTS_ENGINE=none responde 404 TTS_DISABLED e a entrevista grava tts: null', async () => {
    const { c, cookie, interview, messageId } = await setup({ disabled: true });
    expect(interview.engines.tts).toBeNull();
    const res = await c.app.inject({ method: 'GET', url: `/api/v1/messages/${messageId}/speech`, headers: { cookie } });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('TTS_DISABLED');
  });

  it('serviço de voz fora do ar responde 502 sem derrubar a conversa', async () => {
    const { c, cookie, messageId } = await setup({ failWith: new TypeError('fetch failed') });
    const res = await c.app.inject({ method: 'GET', url: `/api/v1/messages/${messageId}/speech`, headers: { cookie } });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('ENGINE_FAILURE');
  });
});
