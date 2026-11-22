/** Entidades do domínio. Independentes de HTTP, banco e fornecedores. */

export type Level = 'junior' | 'pleno' | 'senior';
export type InterviewKind = 'comportamental' | 'tecnica' | 'mista';
export type InterviewStatus = 'active' | 'finished';
export type MessageAuthor = 'interviewer' | 'candidate';
export type InputMode = 'text' | 'voice';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  /** Voz preferida; null = TTS_VOICE do servidor. */
  ttsVoice: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  /** Hash SHA-256 do token. O token em si só existe no cookie. */
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface InterviewConfig {
  role: string;
  company: string;
  level: Level;
  kind: InterviewKind;
  jobDescription: string | null;
  resume: string | null;
}

export interface EngineNames {
  stt: string | null;
  llm: string;
  tts: string | null;
}

export interface Interview extends InterviewConfig {
  id: string;
  userId: string;
  status: InterviewStatus;
  engines: EngineNames;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface Timings {
  sttMs: number | null;
  llmMs: number | null;
  ttsMs: number | null;
}

export interface Message {
  id: string;
  interviewId: string;
  author: MessageAuthor;
  content: string;
  inputMode: InputMode | null;
  audioSeconds: number | null;
  timings: Timings;
  createdAt: Date;
}

export interface FeedbackSuggestion {
  question: string;
  answer: string;
  suggestion: string;
}

export interface Feedback {
  interviewId: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  suggestions: FeedbackSuggestion[];
  model: string;
  llmMs: number;
  createdAt: Date;
}
