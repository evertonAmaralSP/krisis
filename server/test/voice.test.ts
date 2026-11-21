import { afterEach, describe, expect, it } from 'vitest';
import { buildInMemoryApp, TEST_USER } from '../src/testing/inMemoryApp.ts';
import type { FakeSttOptions } from '../src/infra/engines/fake/FakeSttEngine.ts';

type Ctx = Awaited<ReturnType<typeof buildInMemoryApp>>;
let ctx: Ctx | null = null;
afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

/** Corpo multipart/form-data montado à mão, como o navegador envia. */
function multipart(field: string, content: Buffer, contentType: string, filename = 'fala.webm') {
  const boundary = '----krisis-teste';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

async function setup(stt: FakeSttOptions = {}) {
  ctx = await buildInMemoryApp({ replies: ['Primeira pergunta?', 'Segunda pergunta?'] }, stt);
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
      payload: { role: 'Engenheiro de dados', company: 'Empresa X', level: 'senior', kind: 'tecnica' },
    })
  ).json();
  return { c: ctx, cookie, interview };
}

const transcribe = (c: Ctx, cookie: string, id: string, part = multipart('audio', Buffer.from('webm-falso'), 'audio/webm;codecs=opus')) =>
  c.app.inject({
    method: 'POST',
    url: `/api/v1/interviews/${id}/transcriptions`,
    headers: { ...part.headers, cookie },
    payload: part.payload,
  });

describe('Turno por voz', () => {
  it('transcreve sem gravar e o texto confirmado vira mensagem de voz com os tempos', async () => {
    const { c, cookie, interview } = await setup({ text: 'Trabalho com dados há cinco anos.' });

    const res = await transcribe(c, cookie, interview.id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ text: 'Trabalho com dados há cinco anos.', engine: 'fake', model: 'fake-stt-1' });
    expect(body.sttMs).toBeTypeOf('number');

    // O motor recebeu o áudio como enviado e o contexto da vaga.
    const call = c.stt.calls[0]!;
    expect(call.audio.toString()).toBe('webm-falso');
    expect(call.mimeType).toBe('audio/webm'); // o parser entrega o tipo sem os parâmetros de codec
    expect(call.prompt).toContain('Engenheiro de dados');

    // Transcrever não grava nada.
    const before = await c.app.inject({ method: 'GET', url: `/api/v1/interviews/${interview.id}`, headers: { cookie } });
    expect(before.json().messages).toHaveLength(1);

    const turn = await c.app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${interview.id}/messages`,
      headers: { cookie },
      payload: { content: body.text, inputMode: 'voice', audioSeconds: 12.4, sttMs: body.sttMs },
    });
    expect(turn.statusCode).toBe(200);
    expect(turn.json().candidateMessage).toMatchObject({
      author: 'candidate',
      content: 'Trabalho com dados há cinco anos.',
      inputMode: 'voice',
      audioSeconds: 12.4,
      timings: { sttMs: body.sttMs },
    });
  });

  it('responde 422 quando não há fala reconhecível', async () => {
    const { c, cookie, interview } = await setup({ text: 'Legendas pela comunidade Amara.org' });
    const res = await transcribe(c, cookie, interview.id);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('NO_SPEECH');
  });

  it('recusa arquivo que não é áudio, campo errado e corpo que não é multipart', async () => {
    const { c, cookie, interview } = await setup();
    expect((await transcribe(c, cookie, interview.id, multipart('audio', Buffer.from('x'), 'text/plain', 'a.txt'))).statusCode).toBe(415);
    expect((await transcribe(c, cookie, interview.id, multipart('arquivo', Buffer.from('x'), 'audio/webm'))).statusCode).toBe(400);
    // Tipo de áudio fora do contrato: 415 claro, sem chegar ao fornecedor com extensão errada.
    expect((await transcribe(c, cookie, interview.id, multipart('audio', Buffer.from('x'), 'audio/aac', 'a.aac'))).statusCode).toBe(415);
    const json = await c.app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${interview.id}/transcriptions`,
      headers: { cookie },
      payload: { audio: 'x' },
    });
    expect(json.statusCode).toBe(415);
    expect(c.stt.calls).toHaveLength(0);
  });

  it('recusa áudio acima do limite com 413', async () => {
    const { c, cookie, interview } = await setup();
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const res = await transcribe(c, cookie, interview.id, multipart('audio', big, 'audio/webm'));
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('exige sessão e entrevista do próprio usuário', async () => {
    const { c, cookie } = await setup();
    expect((await transcribe(c, '', 'qualquer')).statusCode).toBe(401);
    expect((await transcribe(c, cookie, 'nao-existe')).statusCode).toBe(404);
  });

  it('falha do fornecedor vira 502 sem gravar nada', async () => {
    const { c, cookie, interview } = await setup({ failWith: new Error('fora do ar') });
    const res = await transcribe(c, cookie, interview.id);
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('ENGINE_FAILURE');
  });
});
