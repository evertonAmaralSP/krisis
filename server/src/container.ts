/**
 * Composition root: o único lugar que conhece as implementações concretas.
 * Serviços recebem só interfaces (ports).
 */
import { AuthService } from './application/AuthService.ts';
import { ConversationService } from './application/ConversationService.ts';
import { InterviewService } from './application/InterviewService.ts';
import type { LlmResolver, SttResolver, TtsResolver } from './application/LlmResolver.ts';
import { SpeechService } from './application/SpeechService.ts';
import { TranscriptionService } from './application/TranscriptionService.ts';
import type { Repositories } from './ports/repositories.ts';
import type { PasswordHasher } from './ports/security.ts';

export interface Services {
  auth: AuthService;
  interviews: InterviewService;
  conversation: ConversationService;
  transcription: TranscriptionService;
  speech: SpeechService;
}

export function createServices(deps: {
  repos: Repositories;
  llm: LlmResolver;
  stt: SttResolver;
  tts: TtsResolver;
  voices?: { default: string; available: string[] };
  hasher: PasswordHasher;
  sessionTtlDays: number;
}): Services {
  const conversation = new ConversationService(deps.repos, deps.llm);
  return {
    auth: new AuthService(deps.repos, deps.hasher, deps.sessionTtlDays),
    interviews: new InterviewService(deps.repos, deps.llm, deps.stt, deps.tts, conversation),
    conversation,
    transcription: new TranscriptionService(deps.repos, deps.stt),
    speech: new SpeechService(deps.repos, deps.tts, deps.voices),
  };
}
