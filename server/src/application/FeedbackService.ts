import { v1 } from '@krisis/contracts';
import { AppError, conflict, EngineError, notFound } from '../domain/errors.ts';
import type { Feedback } from '../domain/types.ts';
import type { Repositories } from '../ports/repositories.ts';
import type { LlmResolver } from './LlmResolver.ts';
import { buildFeedbackPrompt, FEEDBACK_JSON_SCHEMA } from './feedback/prompt.ts';
import { computeTimings, type TimingStat } from './feedback/timings.ts';

export interface FeedbackOptions {
  /** Modelo do feedback (vazio = o modelo do motor da entrevista). */
  model?: string | undefined;
  reasoningEffort?: 'low' | 'medium' | 'high' | undefined;
  maxTokens: number;
  timeoutMs?: number | undefined;
}

export type FeedbackView = Feedback & { timings: TimingStat[] };

/** Encerra a entrevista gerando o feedback a partir da transcrição completa. */
export class FeedbackService {
  constructor(
    private readonly repos: Repositories,
    private readonly llm: LlmResolver,
    private readonly options: FeedbackOptions,
  ) {}

  /**
   * Gera o feedback e só então grava feedback + entrevista encerrada, juntos.
   * Se o modelo falhar ou sair do formato, nada muda e dá para tentar de novo.
   */
  async finish(userId: string, interviewId: string): Promise<FeedbackView> {
    const interview = await this.repos.interviews.findById(interviewId, userId);
    if (!interview) throw notFound('Entrevista');
    if (interview.status !== 'active') throw conflict('Esta entrevista já foi encerrada.');

    const messages = await this.repos.messages.listByInterview(interview.id);
    if (!messages.some((m) => m.author === 'candidate')) {
      throw conflict('Responda pelo menos uma pergunta antes de encerrar.');
    }

    const engine = this.llm.get(interview.engines.llm);
    const { system, user } = buildFeedbackPrompt(interview, messages);
    const result = await engine.complete({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: this.options.maxTokens,
      ...(this.options.timeoutMs && { timeoutMs: this.options.timeoutMs }),
      ...(this.options.model && { model: this.options.model }),
      ...(this.options.reasoningEffort && { reasoningEffort: this.options.reasoningEffort }),
      jsonSchema: { name: 'feedback_entrevista', schema: FEEDBACK_JSON_SCHEMA },
    });

    let content: v1.FeedbackContent;
    try {
      content = v1.FeedbackContent.parse(JSON.parse(result.text));
    } catch (err) {
      throw new EngineError(engine.name, 'llm', 'O modelo devolveu o feedback fora do formato. Tente de novo.', {
        cause: err,
      });
    }

    const feedback: Feedback = {
      interviewId: interview.id,
      summary: content.summary,
      strengths: content.strengths,
      improvements: content.improvements,
      suggestions: content.suggestions,
      model: result.model,
      llmMs: result.ms,
      createdAt: new Date(),
    };
    if (!(await this.repos.feedback.saveAndFinish(feedback))) {
      throw conflict('Esta entrevista já foi encerrada.');
    }
    return { ...feedback, timings: computeTimings(messages) };
  }

  async get(userId: string, interviewId: string): Promise<FeedbackView> {
    const interview = await this.repos.interviews.findById(interviewId, userId);
    if (!interview) throw notFound('Entrevista');
    const feedback = await this.repos.feedback.get(interview.id);
    if (!feedback) {
      throw new AppError('NOT_FOUND', 'Esta entrevista ainda não tem feedback. Encerre-a para gerar.');
    }
    const messages = await this.repos.messages.listByInterview(interview.id);
    return { ...feedback, timings: computeTimings(messages) };
  }
}
