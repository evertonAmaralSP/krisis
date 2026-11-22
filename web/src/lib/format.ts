import type { v1 } from '@krisis/contracts';

export const LEVEL_LABEL: Record<v1.Level, string> = { junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior' };
export const KIND_LABEL: Record<v1.InterviewKind, string> = {
  comportamental: 'Comportamental',
  tecnica: 'Técnica',
  mista: 'Mista',
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (sameDay(d, new Date())) return 'Hoje';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

/** 640 → "0,6 s"; 1530 → "1,5 s". */
export function formatMs(ms: number | null): string | null {
  if (ms === null) return null;
  return `${(ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

/** 21.4 → "0:21". */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Linha de tempos exibida sob cada mensagem. */
export function timingLine(m: v1.Message): string {
  const parts: string[] = [];
  if (m.author === 'candidate') {
    if (m.inputMode === 'voice') {
      parts.push(['Voz', formatDuration(m.audioSeconds)].filter(Boolean).join(' · '));
      const stt = formatMs(m.timings.sttMs);
      if (stt) parts.push(`transcrição ${stt}`);
    } else {
      parts.push('Texto');
    }
  } else {
    const llm = formatMs(m.timings.llmMs);
    const tts = formatMs(m.timings.ttsMs);
    if (llm) parts.push(`Modelo ${llm}`);
    if (tts) parts.push(`Voz ${tts}`);
  }
  return parts.join(' · ');
}

export const STAGE_LABEL: Record<v1.TimingStage, string> = {
  stt: 'Transcrição',
  llm: 'Modelo de linguagem',
  tts: 'Voz (início)',
  text: 'Até o texto aparecer',
};

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
}

/** Duração entre duas datas ISO: "18 min" ou "1 h 05 min". */
export function formatSpan(fromIso: string, toIso: string | null): string | null {
  if (!toIso) return null;
  const min = Math.max(1, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
