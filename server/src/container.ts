/**
 * Composition root: o único lugar que conhece as implementações concretas.
 * Serviços recebem só interfaces (ports).
 */
import { AuthService } from './application/AuthService.ts';
import { ConversationService } from './application/ConversationService.ts';
import { InterviewService } from './application/InterviewService.ts';
import type { LlmResolver, SttResolver } from './application/LlmResolver.ts';
import { TranscriptionService } from './application/TranscriptionService.ts';
import type { Repositories } from './ports/repositories.ts';
import type { PasswordHasher } from './ports/security.ts';

export interface Services {
  auth: AuthService;
  interviews: InterviewService;
  conversation: ConversationService;
  transcription: TranscriptionService;
}

export function createServices(deps: {
  repos: Repositories;
  llm: LlmResolver;
  stt: SttResolver;
  hasher: PasswordHasher;
  sessionTtlDays: number;
}): Services {
  const conversation = new ConversationService(deps.repos, deps.llm);
  return {
    auth: new AuthService(deps.repos, deps.hasher, deps.sessionTtlDays),
    interviews: new InterviewService(deps.repos, deps.llm, deps.stt, conversation),
    conversation,
    transcription: new TranscriptionService(deps.repos, deps.stt),
  };
}
