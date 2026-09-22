import { parseNumber } from './number';

// Motor de fórmulas liviano para la hoja de cálculo y la calculadora.
// Soporta: + - * / ^ %, paréntesis, referencias A1, rangos A1:B5, y funciones
// SUMA/SUM, PROMEDIO/AVERAGE, MIN, MAX, REDONDEAR/ROUND, ABS, RAIZ/SQRT, PI, CONTAR/COUNT, SI/IF.
// Decimal con "," o "."; separador de argumentos ";" (o "," cuando no es parte de un número).

export type CellValue = number | string;
export type Resolver = (ref: string) => CellValue;

export const colToIndex = (col: string) => col.toUpperCase().split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
export const indexToCol = (i: number) => {
  let s = ''; i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
};
export const parseRef = (ref: string) => {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref);
  if (!m) return null;
  return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
};
export const makeRef = (col: number, row: number) => `${indexToCol(col)}${row + 1}`;

type Tok = { t: 'num'; v: number } | { t: 'ref'; v: string } | { t: 'range'; a: string; b: string } | { t: 'fn'; v: string } | { t: 'op'; v: string } | { t: 'str'; v: string };

const tokenize = (src: string): Tok[] => {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] || ''))) {
      let j = i; let seenDec = false;
      while (j < src.length) {
        const ch = src[j];
        if (/\d/.test(ch)) { j++; continue; }
        if ((ch === '.' || ch === ',') && !seenDec && /\d/.test(src[j + 1] || '')) { seenDec = true; j++; continue; }
        break;
      }
      out.push({ t: 'num', v: parseFloat(src.slice(i, j).replace(',', '.')) });
      i = j; continue;
    }
    if (c === '"') {
      const j = src.indexOf('"', i + 1);
      out.push({ t: 'str', v: src.slice(i + 1, j === -1 ? undefined : j) });
      i = j === -1 ? src.length : j + 1; continue;
    }
    if (/[A-Za-z$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9$_.]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (src[j] === ':') {
        let k = j + 1;
        while (k < src.length && /[A-Za-z0-9$]/.test(src[k])) k++;
        out.push({ t: 'range', a: word.replace(/\$/g, ''), b: src.slice(j + 1, k).replace(/\$/g, '') });
        i = k; continue;
      }
      if (src[j] === '(' ) { out.push({ t: 'fn', v: word.toUpperCase() }); i = j; continue; }
      if (/^\$?[A-Za-z]{1,3}\$?\d+$/.test(word)) { out.push({ t: 'ref', v: word.replace(/\$/g, '').toUpperCase() }); i = j; continue; }
      if (word.toUpperCase() === 'PI') { out.push({ t: 'num', v: Math.PI }); i = j; continue; }
      throw new Error('#NOMBRE?');
    }
    if (c === ';' || c === ',') { out.push({ t: 'op', v: ';' }); i++; continue; }
    if (c === '<' || c === '>') {
      if (src[i + 1] === '=' || (c === '<' && src[i + 1] === '>')) { out.push({ t: 'op', v: c + src[i + 1] }); i += 2; continue; }
      out.push({ t: 'op', v: c }); i++; continue;
    }
    if ('+-*/^()%='.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new Error('#ERROR');
  }
  return out;
};

const toNum = (v: CellValue): number => {
  if (typeof v === 'number') return v;
  if (v === '' || v === undefined || v === null) return 0;
  const str = String(v).trim();
  if (/^-?[\d.,\s$]+$/.test(str) && /\d/.test(str)) return parseNumber(str, 'money');
  throw new Error('#VALOR!');
};

export const evaluate = (src: string, resolve: Resolver = () => 0): CellValue => {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = toks[p]; return t && t.t === 'op' && t.v === v; };
  const expect = (v: string) => { if (!isOp(v)) throw new Error('#ERROR'); p++; };

  const rangeValues = (a: string, b: string): CellValue[] => {
    const ra = parseRef(a), rb = parseRef(b);
    if (!ra || !rb) throw new Error('#REF!');
    const vals: CellValue[] = [];
    for (let r = Math.min(ra.row, rb.row); r <= Math.max(ra.row, rb.row); r++)
      for (let c = Math.min(ra.col, rb.col); c <= Math.max(ra.col, rb.col); c++) vals.push(resolve(makeRef(c, r)));
    return vals;
  };

  const parseArgs = (): CellValue[][] => {
    const args: CellValue[][] = [];
    expect('(');
    if (isOp(')')) { p++; return args; }
    while (true) {
      const t = peek();
      if (t && t.t === 'range') { p++; args.push(rangeValues(t.a, t.b)); }
      else args.push([compare()]);
      if (isOp(';')) { p++; continue; }
      expect(')');
      return args;
    }
  };

  const nums = (args: CellValue[][]) => args.flat().filter(v => v !== '' && !(typeof v === 'string' && !Number.isFinite(parseFloat(v)))).map(toNum);

  const callFn = (name: string, args: CellValue[][]): CellValue => {
    switch (name) {
      case 'SUM': case 'SUMA': return nums(args).reduce((a, b) => a + b, 0);
      case 'AVERAGE': case 'PROMEDIO': { const n = nums(args); if (!n.length) throw new Error('#DIV/0!'); return n.reduce((a, b) => a + b, 0) / n.length; }
      case 'MIN': { const n = nums(args); return n.length ? Math.min(...n) : 0; }
      case 'MAX': { const n = nums(args); return n.length ? Math.max(...n) : 0; }
      case 'COUNT': case 'CONTAR': return nums(args).length;
      case 'ROUND': case 'REDONDEAR': { const v = toNum(args[0]?.[0] ?? 0); const d = toNum(args[1]?.[0] ?? 0); const f = Math.pow(10, d); return Math.round(v * f) / f; }
      case 'ROUNDUP': case 'REDONDEAR.MAS': { const v = toNum(args[0]?.[0] ?? 0); const f = Math.pow(10, toNum(args[1]?.[0] ?? 0)); return Math.ceil(v * f) / f; }
      case 'ROUNDDOWN': case 'REDONDEAR.MENOS': { const v = toNum(args[0]?.[0] ?? 0); const f = Math.pow(10, toNum(args[1]?.[0] ?? 0)); return Math.floor(v * f) / f; }
      case 'ABS': return Math.abs(toNum(args[0]?.[0] ?? 0));
      case 'SQRT': case 'RAIZ': { const v = toNum(args[0]?.[0] ?? 0); if (v < 0) throw new Error('#NUM!'); return Math.sqrt(v); }
      case 'POWER': case 'POTENCIA': return Math.pow(toNum(args[0]?.[0] ?? 0), toNum(args[1]?.[0] ?? 0));
      case 'IF': case 'SI': return toNum(args[0]?.[0] ?? 0) ? (args[1]?.[0] ?? 0) : (args[2]?.[0] ?? 0);
      case 'PI': return Math.PI;
      default: throw new Error('#NOMBRE?');
    }
  };

  const primary = (): CellValue => {
    const t = peek();
    if (!t) throw new Error('#ERROR');
    if (t.t === 'num') { p++; return t.v; }
    if (t.t === 'str') { p++; return t.v; }
    if (t.t === 'ref') { p++; return resolve(t.v); }
    if (t.t === 'range') { p++; const v = rangeValues(t.a, t.b); return v.length === 1 ? v[0] : (() => { throw new Error('#VALOR!'); })(); }
    if (t.t === 'fn') { p++; return callFn(t.v, parseArgs()); }
    if (isOp('(')) { p++; const v = compare(); expect(')'); return v; }
    if (isOp('-')) { p++; return -toNum(power()); }
    if (isOp('+')) { p++; return toNum(power()); }
    throw new Error('#ERROR');
  };
  const postfix = (): CellValue => { let v = primary(); while (isOp('%')) { p++; v = toNum(v) / 100; } return v; };
  const power = (): CellValue => { const b = postfix(); if (isOp('^')) { p++; return Math.pow(toNum(b), toNum(power())); } return b; };
  const term = (): CellValue => {
    let v = power();
    while (isOp('*') || isOp('/')) {
      const op = (toks[p++] as any).v; const r = toNum(power());
      if (op === '/' && r === 0) throw new Error('#DIV/0!');
      v = op === '*' ? toNum(v) * r : toNum(v) / r;
    }
    return v;
  };
  const expr = (): CellValue => {
    let v = term();
    while (isOp('+') || isOp('-')) { const op = (toks[p++] as any).v; const r = toNum(term()); v = op === '+' ? toNum(v) + r : toNum(v) - r; }
    return v;
  };
  const compare = (): CellValue => {
    const l = expr();
    const t = peek();
    if (t && t.t === 'op' && ['=', '<', '>', '<=', '>=', '<>'].includes(t.v)) {
      p++; const a = toNum(l), b = toNum(expr());
      switch (t.v) { case '=': return +(a === b); case '<': return +(a < b); case '>': return +(a > b); case '<=': return +(a <= b); case '>=': return +(a >= b); default: return +(a !== b); }
    }
    return l;
  };

  const result = compare();
  if (p < toks.length) throw new Error('#ERROR');
  if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('#NUM!');
  return result;
};

/** Para la calculadora: acepta "1.234,5 / 3" o "1234.5/3". Devuelve null si no es válido. */
export const evaluateExpression = (src: string): number | null => {
  const cleaned = src.trim().replace(/^=/, '').replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/\$/g, '');
  if (!cleaned) return null;
  // Normaliza números con miles "1.234.567,8" → "1234567,8"
  const normalized = cleaned.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?/g, m => m.replace(/\./g, ''));
  try {
    const v = evaluate(normalized);
    return typeof v === 'number' ? v : null;
  } catch { return null; }
};
