import { APU, Chapter } from '../types';

export const isSubchapter = (chapter: Chapter): boolean => !!chapter.parentChapterId;

export const getRootChapters = (chapters: Chapter[], projectId: string): Chapter[] =>
  chapters.filter(c => c.projectId === projectId && !c.parentChapterId);

export const getSubchapters = (chapters: Chapter[], parentChapterId: string): Chapter[] =>
  chapters.filter(c => c.parentChapterId === parentChapterId);

/** Un capítulo raíz y todos sus subcapítulos directos (un solo nivel de anidamiento). */
export const getDescendantChapterIds = (chapters: Chapter[], chapterId: string): string[] => [
  chapterId,
  ...chapters.filter(c => c.parentChapterId === chapterId).map(c => c.id)
];

export type ChapterChild =
  | { kind: 'apu'; id: string; apu: APU }
  | { kind: 'sub'; id: string; chapter: Chapter };

/**
 * Hijos directos de un capítulo raíz (partidas propias y subcapítulos) en su orden mezclado.
 * Primero los ids listados en `childOrder` que aún existen; luego los no listados en el orden
 * heredado (subcapítulos, después partidas). Un subcapítulo solo tiene partidas: devuelve esas.
 */
export const getChapterChildren = (chapter: Chapter, chapters: Chapter[], apus: APU[]): ChapterChild[] => {
  const direct: ChapterChild[] = apus.filter(a => a.chapterId === chapter.id).map(apu => ({ kind: 'apu', id: apu.id, apu }));
  if (chapter.parentChapterId) return direct;
  const subs: ChapterChild[] = getSubchapters(chapters, chapter.id).map(sub => ({ kind: 'sub', id: sub.id, chapter: sub }));
  const byId = new Map<string, ChapterChild>([...subs, ...direct].map(c => [c.id, c]));
  const ordered: ChapterChild[] = [];
  (chapter.childOrder || []).forEach(id => {
    const child = byId.get(id);
    if (child) { ordered.push(child); byId.delete(id); }
  });
  [...subs, ...direct].forEach(c => { if (byId.has(c.id)) ordered.push(c); });
  return ordered;
};

/** Inserta `id` antes de `beforeId` (o al final si es null / no está), quitándolo antes de su posición previa. */
export const insertInOrder = (ids: string[], id: string, beforeId: string | null): string[] => {
  const result = ids.filter(i => i !== id);
  const at = beforeId !== null ? result.indexOf(beforeId) : -1;
  result.splice(at === -1 ? result.length : at, 0, id);
  return result;
};

export interface OutlineApu { apu: APU; number: string }
export type OutlineEntry =
  | { kind: 'apu'; apu: APU; number: string }
  | { kind: 'sub'; chapter: Chapter; number: string; apus: OutlineApu[] };
export interface OutlineChapter { chapter: Chapter; number: string; entries: OutlineEntry[] }

/**
 * Estructura numerada del proyecto — fuente única de numeración para la app, los PDF y el Excel.
 * Capítulo N; sus hijos se numeran N.1, N.2… en su orden mezclado; partidas de un subcapítulo N.k.1, N.k.2…
 */
export const buildChapterOutline = (chapters: Chapter[], apus: APU[], projectId: string): OutlineChapter[] =>
  getRootChapters(chapters, projectId).map((chapter, cIdx) => {
    const number = String(cIdx + 1);
    const entries: OutlineEntry[] = getChapterChildren(chapter, chapters, apus).map((child, i) => {
      const childNumber = `${number}.${i + 1}`;
      return child.kind === 'apu'
        ? { kind: 'apu', apu: child.apu, number: childNumber }
        : {
          kind: 'sub', chapter: child.chapter, number: childNumber,
          apus: apus.filter(a => a.chapterId === child.chapter.id).map((apu, j) => ({ apu, number: `${childNumber}.${j + 1}` }))
        };
    });
    return { chapter, number, entries };
  });
