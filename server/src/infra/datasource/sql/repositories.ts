/**
 * Repositórios SQL escritos uma única vez com Kysely. Servem a qualquer
 * SqlDataSource (SQLite hoje, Postgres amanhã), porque o dialeto fica no Kysely.
 */
import { randomUUID } from 'node:crypto';
import type { Kysely, Selectable } from 'kysely';
import type {
  Feedback,
  InputMode,
  Interview,
  InterviewKind,
  InterviewStatus,
  Level,
  Message,
  MessageAuthor,
  User,
} from '../../../domain/types.ts';
import { conflict, notFound } from '../../../domain/errors.ts';
import type {
  FeedbackRepository,
  InterviewRepository,
  MessageRepository,
  NewMessage,
  Repositories,
  SessionRepository,
  UserRepository,
} from '../../../ports/repositories.ts';
import type { Database, FeedbackTable, InterviewsTable, MessagesTable, UsersTable } from './schema.ts';

const iso = (d: Date) => d.toISOString();

const toUser = (r: Selectable<UsersTable>): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  passwordHash: r.password_hash,
  ttsVoice: r.tts_voice,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

const toInterview = (r: Selectable<InterviewsTable>): Interview => ({
  id: r.id,
  userId: r.user_id,
  role: r.role,
  company: r.company,
  level: r.level as Level,
  kind: r.kind as InterviewKind,
  jobDescription: r.job_description,
  resume: r.resume,
  status: r.status as InterviewStatus,
  engines: { stt: r.stt_engine, llm: r.llm_engine, tts: r.tts_engine },
  createdAt: new Date(r.created_at),
  finishedAt: r.finished_at ? new Date(r.finished_at) : null,
});

const toMessage = (r: Selectable<MessagesTable>): Message => ({
  id: r.id,
  interviewId: r.interview_id,
  author: r.author as MessageAuthor,
  content: r.content,
  inputMode: r.input_mode as InputMode | null,
  audioSeconds: r.audio_seconds,
  timings: { sttMs: r.stt_ms, llmMs: r.llm_ms, ttsMs: r.tts_ms },
  createdAt: new Date(r.created_at),
});

class SqlUserRepository implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async count() {
    const r = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .executeTakeFirstOrThrow();
    return Number(r.n);
  }

  async findById(id: string) {
    const r = await this.db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
    return r ? toUser(r) : null;
  }

  async findByEmail(email: string) {
    const r = await this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst();
    return r ? toUser(r) : null;
  }

  async create(input: { name: string; email: string; passwordHash: string }) {
    const now = iso(new Date());
    const row = {
      id: randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      password_hash: input.passwordHash,
      tts_voice: null,
      created_at: now,
      updated_at: now,
    };
    await this.db.insertInto('users').values(row).execute();
    return toUser(row);
  }

  async update(id: string, patch: Partial<Pick<User, 'name' | 'email' | 'passwordHash' | 'ttsVoice'>>) {
    await this.db
      .updateTable('users')
      .set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.email !== undefined && { email: patch.email.toLowerCase() }),
        ...(patch.passwordHash !== undefined && { password_hash: patch.passwordHash }),
        ...(patch.ttsVoice !== undefined && { tts_voice: patch.ttsVoice }),
        updated_at: iso(new Date()),
      })
      .where('id', '=', id)
      .execute();
    const user = await this.findById(id);
    if (!user) throw notFound('Usuário');
    return user;
  }
}

class SqlSessionRepository implements SessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(s: { id: string; userId: string; expiresAt: Date; createdAt: Date }) {
    await this.db
      .insertInto('sessions')
      .values({
        id: s.id,
        user_id: s.userId,
        expires_at: iso(s.expiresAt),
        created_at: iso(s.createdAt),
      })
      .execute();
  }

  async findValid(id: string, now: Date) {
    const r = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', id)
      .where('expires_at', '>', iso(now))
      .executeTakeFirst();
    return r
      ? {
          id: r.id,
          userId: r.user_id,
          expiresAt: new Date(r.expires_at),
          createdAt: new Date(r.created_at),
        }
      : null;
  }

  async delete(id: string) {
    await this.db.deleteFrom('sessions').where('id', '=', id).execute();
  }

  async deleteAllForUserExcept(userId: string, keepId: string | null) {
    let q = this.db.deleteFrom('sessions').where('user_id', '=', userId);
    if (keepId) q = q.where('id', '!=', keepId);
    await q.execute();
  }

  async deleteExpired(now: Date) {
    await this.db.deleteFrom('sessions').where('expires_at', '<=', iso(now)).execute();
  }
}

class SqlInterviewRepository implements InterviewRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: Parameters<InterviewRepository['create']>[0]) {
    const row: Selectable<InterviewsTable> = {
      id: randomUUID(),
      user_id: input.userId,
      role: input.role,
      company: input.company,
      level: input.level,
      kind: input.kind,
      job_description: input.jobDescription,
      resume: input.resume,
      stt_engine: input.engines.stt,
      llm_engine: input.engines.llm,
      tts_engine: input.engines.tts,
      status: 'active',
      created_at: iso(new Date()),
      finished_at: null,
    };
    await this.db.insertInto('interviews').values(row).execute();
    return toInterview(row);
  }

  async findById(id: string, userId: string) {
    const r = await this.db
      .selectFrom('interviews')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return r ? toInterview(r) : null;
  }

  async delete(id: string, userId: string) {
    const r = await this.db
      .deleteFrom('interviews')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return Number(r.numDeletedRows) > 0;
  }

  async listByUser(userId: string) {
    const rows = await this.db
      .selectFrom('interviews')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toInterview);
  }
}

class SqlMessageRepository implements MessageRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findForUser(messageId: string, userId: string) {
    const row = await this.db
      .selectFrom('messages')
      .innerJoin('interviews', 'interviews.id', 'messages.interview_id')
      .selectAll('messages')
      .select('interviews.user_id as owner_id')
      .where('messages.id', '=', messageId)
      .where('interviews.user_id', '=', userId)
      .executeTakeFirst();
    if (!row) return null;
    const interview = await this.db
      .selectFrom('interviews')
      .selectAll()
      .where('id', '=', row.interview_id)
      .executeTakeFirstOrThrow();
    const { owner_id: _owner, ...message } = row;
    return { message: toMessage(message), interview: toInterview(interview) };
  }

  async setTtsMs(messageId: string, ms: number) {
    await this.db.updateTable('messages').set({ tts_ms: ms }).where('id', '=', messageId).execute();
  }

  async listByInterview(interviewId: string) {
    const rows = await this.db
      .selectFrom('messages')
      .selectAll()
      .where('interview_id', '=', interviewId)
      .orderBy('seq', 'asc')
      .execute();
    return rows.map(toMessage);
  }

  async createMany(messages: NewMessage[]) {
    if (messages.length === 0) return [];
    return this.db.transaction().execute(async (trx) => {
      const interviewId = messages[0]!.interviewId;
      // Um turno que começou antes de encerrar não grava depois do feedback.
      const interview = await trx.selectFrom('interviews').select('status').where('id', '=', interviewId).executeTakeFirst();
      if (interview && interview.status !== 'active') throw conflict('Esta entrevista já foi encerrada.');
      const last = await trx
        .selectFrom('messages')
        .select((eb) => eb.fn.max('seq').as('seq'))
        .where('interview_id', '=', interviewId)
        .executeTakeFirst();
      let seq = Number(last?.seq ?? 0);
      const created: Message[] = [];
      for (const m of messages) {
        seq += 1;
        const row: Selectable<MessagesTable> = {
          id: randomUUID(),
          interview_id: m.interviewId,
          seq,
          author: m.author,
          content: m.content,
          input_mode: m.inputMode,
          audio_seconds: m.audioSeconds,
          stt_ms: m.timings.sttMs,
          llm_ms: m.timings.llmMs,
          tts_ms: m.timings.ttsMs,
          created_at: iso(new Date()),
        };
        await trx.insertInto('messages').values(row).execute();
        created.push(toMessage(row));
      }
      return created;
    });
  }
}

const toFeedback = (r: Selectable<FeedbackTable>): Feedback => ({
  interviewId: r.interview_id,
  summary: r.summary,
  strengths: JSON.parse(r.strengths) as string[],
  improvements: JSON.parse(r.improvements) as string[],
  suggestions: JSON.parse(r.suggestions) as Feedback['suggestions'],
  model: r.model,
  llmMs: r.llm_ms,
  createdAt: new Date(r.created_at),
});

class SqlFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async get(interviewId: string) {
    const r = await this.db.selectFrom('feedback').selectAll().where('interview_id', '=', interviewId).executeTakeFirst();
    return r ? toFeedback(r) : null;
  }

  async saveAndFinish(f: Feedback) {
    return this.db.transaction().execute(async (trx) => {
      // Só encerra quem ainda está aberta: dois pedidos simultâneos não gravam dois feedbacks.
      const updated = await trx
        .updateTable('interviews')
        .set({ status: 'finished', finished_at: iso(f.createdAt) })
        .where('id', '=', f.interviewId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows) === 0) return false;
      await trx
        .insertInto('feedback')
        .values({
          interview_id: f.interviewId,
          summary: f.summary,
          strengths: JSON.stringify(f.strengths),
          improvements: JSON.stringify(f.improvements),
          suggestions: JSON.stringify(f.suggestions),
          model: f.model,
          llm_ms: f.llmMs,
          created_at: iso(f.createdAt),
        })
        .execute();
      return true;
    });
  }
}

export function createSqlRepositories(db: Kysely<Database>): Repositories {
  return {
    users: new SqlUserRepository(db),
    sessions: new SqlSessionRepository(db),
    interviews: new SqlInterviewRepository(db),
    messages: new SqlMessageRepository(db),
    feedback: new SqlFeedbackRepository(db),
  };
}
