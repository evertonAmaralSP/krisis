import type { EngineNames, Interview, InterviewConfig, Message } from '../domain/types.ts';
import { notFound } from '../domain/errors.ts';
import type { Repositories } from '../ports/repositories.ts';
import type { ConversationService } from './ConversationService.ts';
import type { LlmResolver, SttResolver, TtsResolver } from './LlmResolver.ts';
import { TTS_DISABLED } from './SpeechService.ts';

export class InterviewService {
  constructor(
    private readonly repos: Repositories,
    private readonly llm: LlmResolver,
    private readonly stt: SttResolver,
    private readonly tts: TtsResolver,
    private readonly conversation: ConversationService,
  ) {}

  /**
   * Gera a primeira pergunta e só então grava a entrevista com ela.
   * Se o modelo falhar, nada fica gravado.
   */
  async create(userId: string, config: InterviewConfig): Promise<Interview & { messages: Message[] }> {
    const tts = this.tts.defaultName();
    const engines: EngineNames = {
      stt: this.stt.defaultName(),
      llm: this.llm.defaultName(),
      tts: tts === TTS_DISABLED ? null : tts,
    };
    const opening = await this.conversation.opening(config, engines.llm);

    const interview = await this.repos.interviews.create({ ...config, userId, engines });
    const messages = await this.repos.messages.createMany([
      {
        interviewId: interview.id,
        author: 'interviewer',
        content: opening.text,
        inputMode: null,
        audioSeconds: null,
        timings: { sttMs: null, llmMs: opening.ms, ttsMs: null },
      },
    ]);
    return { ...interview, messages };
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repos.interviews.delete(id, userId))) throw notFound('Entrevista');
  }

  list(userId: string): Promise<Interview[]> {
    return this.repos.interviews.listByUser(userId);
  }

  async get(userId: string, id: string): Promise<Interview & { messages: Message[] }> {
    const interview = await this.repos.interviews.findById(id, userId);
    if (!interview) throw notFound('Entrevista');
    const messages = await this.repos.messages.listByInterview(id);
    return { ...interview, messages };
  }
}
