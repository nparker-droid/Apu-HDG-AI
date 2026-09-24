import { Chapter } from '../types';

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
