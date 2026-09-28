import { Project } from '../types';

// Caracteres no válidos en nombres de archivo (Windows/macOS)
const clean = (s: string) => (s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

/**
 * Nombre de archivo de documentos exportados: HDG-CODIGO-DOCUMENTO-REV VERSION.ext
 * Evita duplicar prefijos si el código ya incluye "HDG-" o la versión ya incluye "REV".
 */
export const buildDocFileName = (project: Project, document: string, ext: string) => {
  const code = clean(project.code).replace(/^HDG[-_\s]*/i, '') || 'SIN-CODIGO';
  const version = clean(project.version).replace(/^REV\.?\s*/i, '') || '0';
  return `HDG-${code}-${clean(document).toUpperCase()}-REV ${version}.${ext}`;
};
