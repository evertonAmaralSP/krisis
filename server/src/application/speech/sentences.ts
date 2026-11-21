/**
 * Divide a fala do entrevistador em trechos, para gerar e tocar a voz trecho a trecho:
 * o primeiro começa a tocar enquanto os seguintes são gerados.
 *
 * Medido no Kokoro em CPU (i7-1355U): a síntese cresce mais rápido que o texto
 * (13 caracteres ≈ 0,8 s; 66 ≈ 1,8 s; 130 ≈ 3,9 s), enquanto a fala dura ~1 s a cada
 * 14 caracteres. Uma frase longa depois de uma curta deixava ~3 s de silêncio.
 * Por isso nenhum trecho passa de MAX_CHARS: assim cada um fica pronto antes de o
 * anterior terminar de tocar.
 *
 * Regras (o mesmo texto sempre dá os mesmos trechos):
 * - corta depois de . ! ? … seguidos de espaço, exceto em abreviações e números;
 * - junta pedaços muito curtos ao seguinte, para não picotar;
 * - quebra frases longas numa vírgula, ponto e vírgula ou dois-pontos; senão, entre palavras.
 */
const ABBREVIATIONS = new Set([
  'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa', 'ex', 'etc', 'p', 'pág', 'nº', 'vs', 'obs', 'aprox', 'eng',
]);

const MIN_CHARS = 8;
export const MAX_CHARS = 70;
/**
 * O primeiro trecho é menor quando há uma pausa natural (vírgula etc.): ele define quando
 * a voz começa. 40 caracteres ≈ 1,1 s de síntese e ≈ 2,8 s de fala, tempo de sobra para o
 * trecho seguinte (até 70) ficar pronto. Sem pausa natural, a frase não é picotada.
 */
export const FIRST_MAX_CHARS = 40;
/** Um corte não deixa sobrar um pedaço menor que isso. */
const MIN_PIECE = 20;

function sentences(clean: string): string[] {
  const raw: string[] = [];
  let start = 0;
  const re = /[.!?…]+["”')]*\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const piece = clean.slice(start, m.index + m[0].trimEnd().length);
    const lastWord = piece.split(' ').pop()!.replace(/[.!?…"”')]+$/, '').toLowerCase();
    if (ABBREVIATIONS.has(lastWord)) continue;
    raw.push(piece.trim());
    start = m.index + m[0].length;
  }
  if (start < clean.length) raw.push(clean.slice(start).trim());
  return raw;
}

function mergeShort(pieces: string[]): string[] {
  const out: string[] = [];
  for (const piece of pieces) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.length < MIN_CHARS) out[out.length - 1] = `${prev} ${piece}`;
    else out.push(piece);
  }
  if (out.length > 1 && out[out.length - 1]!.length < MIN_CHARS) {
    const last = out.pop()!;
    out[out.length - 1] = `${out[out.length - 1]} ${last}`;
  }
  return out;
}

/** Quebra um trecho longo em pedaços de até MAX_CHARS, preferindo pausas naturais. */
function splitLong(piece: string, max = MAX_CHARS, wordCut = true, minPiece = MIN_PIECE): string[] {
  const out: string[] = [];
  let rest = piece;
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    // 1) depois de vírgula, ponto e vírgula, dois-pontos ou travessão
    let cut = -1;
    for (const mark of [', ', '; ', ': ', ' — ', ' – ']) {
      const at = window.lastIndexOf(mark);
      if (at >= minPiece) cut = Math.max(cut, at + mark.trimEnd().length);
    }
    // 2) senão, no último espaço (se permitido)
    if (cut < minPiece && wordCut) cut = window.lastIndexOf(' ');
    if (cut < minPiece) break; // sem lugar razoável para cortar: fica longo
    // 3) se sobraria um pedaço curto demais, corta perto do meio
    if (rest.length - cut < minPiece && wordCut) {
      const middle = rest.lastIndexOf(' ', Math.floor(rest.length / 2));
      if (middle >= minPiece) cut = middle;
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const pieces = mergeShort(sentences(clean));
  const [first, ...others] = pieces;
  // Só o começo do primeiro trecho fica curto (e só numa pausa natural); o resto segue o limite normal.
  const [head, ...tail] = splitLong(first!, FIRST_MAX_CHARS, false, MIN_CHARS);
  const firstParts = tail.length ? [head!, ...splitLong(tail.join(' '))] : splitLong(first!);
  return [...firstParts, ...others.flatMap((p) => splitLong(p))];
}
