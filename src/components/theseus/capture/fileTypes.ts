/**
 * Capture file type validation, icons, and size formatting.
 */

export const ACCEPTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx', '.doc',
  '.xlsx', '.xls',
  '.pptx', '.ppt',
  '.py', '.js', '.ts', '.tsx', '.jsx',
  '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.toml', '.html', '.htm',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp',
]);

export const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/xml',
  'application/x-yaml',
  'text/yaml',
  'application/toml',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'text/x-python',
  'application/x-python-code',
]);

/** 50 MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Max files per batch */
export const MAX_BATCH_SIZE = 20;

/** Accept string for <input type="file"> */
export const ACCEPT_STRING = Array.from(ACCEPTED_MIME_TYPES).join(',') +
  ',' + Array.from(ACCEPTED_EXTENSIONS).join(',');

export function validateFile(file: File): { valid: boolean; error?: string } {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ACCEPTED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type ${ext} not supported` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File exceeds 50MB limit' };
  }
  return { valid: true };
}

const EXT_ICONS: Record<string, string> = {
  '.pdf': '\u{1F4C4}',
  '.docx': '\u{1F4DD}', '.doc': '\u{1F4DD}',
  '.xlsx': '\u{1F4CA}', '.xls': '\u{1F4CA}',
  '.pptx': '\u{1F4FD}', '.ppt': '\u{1F4FD}',
  '.py': '\u{1F4BB}', '.js': '\u{1F4BB}', '.ts': '\u{1F4BB}',
  '.tsx': '\u{1F4BB}', '.jsx': '\u{1F4BB}',
  '.jpg': '\u{1F5BC}', '.jpeg': '\u{1F5BC}', '.png': '\u{1F5BC}',
  '.gif': '\u{1F5BC}', '.webp': '\u{1F5BC}', '.tiff': '\u{1F5BC}', '.bmp': '\u{1F5BC}',
  '.txt': '\u{1F4C3}', '.md': '\u{1F4C3}',
};

export function getFileIcon(filename: string): string {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return EXT_ICONS[ext] ?? '\u{1F4CE}';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
