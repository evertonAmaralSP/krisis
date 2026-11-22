/**
 * Portas de persistência. Os serviços conhecem só estas interfaces;
 * cada DataSource entrega uma implementação de todas elas.
 */
import type { Interview, InterviewConfig, EngineNames, Message, Session, User } from '../domain/types.ts';

export interface UserRepository {
  count(): Promise<number>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: { name: string; email: string; passwordHash: string }): Promise<User>;
  update(id: string, patch: Partial<Pick<User, 'name' | 'email' | 'passwordHash' | 'ttsVoice'>>): Promise<User>;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findValid(id: string, now: Date): Promise<Session | null>;
  delete(id: string): Promise<void>;
  deleteAllForUserExcept(userId: string, keepId: string | null): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}

export interface InterviewRepository {
  create(input: InterviewConfig & { userId: string; engines: EngineNames }): Promise<Interview>;
  findById(id: string, userId: string): Promise<Interview | null>;
  listByUser(userId: string): Promise<Interview[]>;
  /** Apaga a entrevista (e as mensagens, em cascata). false se não existir ou não for do usuário. */
  delete(id: string, userId: string): Promise<boolean>;
}

export type NewMessage = Omit<Message, 'id' | 'createdAt'>;

export interface MessageRepository {
  listByInterview(interviewId: string): Promise<Message[]>;
  /** A mensagem e a entrevista dela, só se a entrevista for do usuário. */
  findForUser(messageId: string, userId: string): Promise<{ message: Message; interview: Interview } | null>;
  setTtsMs(messageId: string, ms: number): Promise<void>;
  /** Grava várias mensagens de forma atômica, na ordem dada. */
  createMany(messages: NewMessage[]): Promise<Message[]>;
}

/** Conjunto de repositórios que um DataSource entrega. */
export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  interviews: InterviewRepository;
  messages: MessageRepository;
}
