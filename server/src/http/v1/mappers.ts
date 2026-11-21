/** Domínio → DTOs do contrato v1. Datas viram ISO-8601. */
import type { v1 } from '@krisis/contracts';
import type { Interview, Message, User } from '../../domain/types.ts';

export const toUserDto = (u: User): v1.User => ({ id: u.id, name: u.name, email: u.email });

export const toMessageDto = (m: Message): v1.Message => ({
  id: m.id,
  interviewId: m.interviewId,
  author: m.author,
  content: m.content,
  inputMode: m.inputMode,
  audioSeconds: m.audioSeconds,
  timings: m.timings,
  createdAt: m.createdAt.toISOString(),
});

export const toInterviewSummaryDto = (i: Interview): v1.InterviewSummary => ({
  id: i.id,
  role: i.role,
  company: i.company,
  level: i.level,
  kind: i.kind,
  status: i.status,
  createdAt: i.createdAt.toISOString(),
  finishedAt: i.finishedAt?.toISOString() ?? null,
});

export const toInterviewDto = (i: Interview & { messages: Message[] }): v1.Interview => ({
  ...toInterviewSummaryDto(i),
  jobDescription: i.jobDescription,
  resume: i.resume,
  engines: i.engines,
  messages: i.messages.map(toMessageDto),
});
