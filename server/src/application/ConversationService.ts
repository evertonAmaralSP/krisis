import type { InputMode, InterviewConfig, Message } from '../domain/types.ts';
import { conflict, notFound } from '../domain/errors.ts';
import type { ChatMessage, LlmResult } from '../ports/engines.ts';
import type { Repositories } from '../ports/repositories.ts';
import type { LlmResolver } from './LlmResolver.ts';
import { buildInterviewerSystemPrompt, OPENING_REQUEST } from './interviewer/prompts.ts';

export interface CandidateInput {
  content: string;
  inputMode: InputMode;
  audioSeconds?: number | undefined;
  sttMs?: number | undefined;
}

/** O turno da entrevista: histórico → modelo → grava as duas falas juntas. */
export class ConversationService {
  constructor(
    private readonly repos: Repositories,
    private readonly llm: LlmResolver,
  ) {}

  /** Gera a primeira pergunta. Não grava nada: quem cria a entrevista grava. */
  opening(config: InterviewConfig, llmName: string): Promise<LlmResult> {
    return this.llm.get(llmName).complete({
      messages: [
        { role: 'system', content: buildInterviewerSystemPrompt(config) },
        { role: 'user', content: OPENING_REQUEST },
      ],
    });
  }

  /**
   * Responde ao candidato. O modelo é chamado antes de gravar: se ele falhar,
   * nada é gravado e o cliente pode reenviar a mesma fala sem duplicar.
   */
  async reply(
    userId: string,
    interviewId: string,
    input: CandidateInput,
  ): Promise<{ candidateMessage: Message; interviewerMessage: Message }> {
    const interview = await this.repos.interviews.findById(interviewId, userId);
    if (!interview) throw notFound('Entrevista');
    if (interview.status !== 'active') throw conflict('Esta entrevista já foi encerrada.');

    const history = await this.repos.messages.listByInterview(interview.id);
    const messages: ChatMessage[] = [
      { role: 'system', content: buildInterviewerSystemPrompt(interview) },
      ...history.map<ChatMessage>((m) => ({
        role: m.author === 'interviewer' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: input.content },
    ];
    const result = await this.llm.get(interview.engines.llm).complete({ messages });

    const [candidateMessage, interviewerMessage] = await this.repos.messages.createMany([
      {
        interviewId: interview.id,
        author: 'candidate',
        content: input.content,
        inputMode: input.inputMode,
        audioSeconds: input.audioSeconds ?? null,
        timings: { sttMs: input.sttMs ?? null, llmMs: null, ttsMs: null },
      },
      {
        interviewId: interview.id,
        author: 'interviewer',
        content: result.text,
        inputMode: null,
        audioSeconds: null,
        timings: { sttMs: null, llmMs: result.ms, ttsMs: null },
      },
    ]);
    return { candidateMessage: candidateMessage!, interviewerMessage: interviewerMessage! };
  }
}
