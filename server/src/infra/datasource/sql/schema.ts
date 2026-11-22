/**
 * Tipos das tabelas para o Kysely. Datas são texto ISO-8601 e números são
 * integer/real, para que o mesmo esquema funcione em SQLite e Postgres.
 */
export interface UsersTable {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  tts_voice: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface InterviewsTable {
  id: string;
  user_id: string;
  role: string;
  company: string;
  level: string;
  kind: string;
  job_description: string | null;
  resume: string | null;
  stt_engine: string | null;
  llm_engine: string;
  tts_engine: string | null;
  status: string;
  created_at: string;
  finished_at: string | null;
}

export interface MessagesTable {
  id: string;
  interview_id: string;
  /** Ordem dentro da entrevista. */
  seq: number;
  author: string;
  content: string;
  input_mode: string | null;
  audio_seconds: number | null;
  stt_ms: number | null;
  llm_ms: number | null;
  tts_ms: number | null;
  created_at: string;
}

export interface FeedbackTable {
  interview_id: string;
  summary: string;
  /** Listas guardadas como JSON em texto (portável SQLite/Postgres). */
  strengths: string;
  improvements: string;
  suggestions: string;
  model: string;
  llm_ms: number;
  created_at: string;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  interviews: InterviewsTable;
  messages: MessagesTable;
  feedback: FeedbackTable;
}
