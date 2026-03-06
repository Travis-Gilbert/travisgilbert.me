/**
 * Studio export helpers.
 * Supports markdown, plain text, and PDF downloads from editor content.
 */

export type StudioExportFormat = 'markdown' | 'txt' | 'pdf';

function sanitizeFileNamePart(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function fileBaseName(title: string, slug: string): string {
  const fromTitle = sanitizeFileNamePart(title);
  const fromSlug = sanitizeFileNamePart(slug);
  return fromTitle || fromSlug || 'studio-export';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '- ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function exportMarkdown(markdown: string, title: string, slug: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${fileBaseName(title, slug)}.md`);
}

function exportText(markdown: string, title: string, slug: string): void {
  const text = plainTextFromMarkdown(markdown);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${fileBaseName(title, slug)}.txt`);
}

async function exportPdf(markdown: string, title: string, slug: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const text = plainTextFromMarkdown(markdown);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const marginX = 54;
  const marginTop = 56;
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineHeight = 18;

  let y = marginTop;
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  const heading = title.trim() || 'Untitled';
  doc.text(heading, marginX, y);
  y += 28;

  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  const lines = doc.splitTextToSize(text || '(Empty document)', maxWidth) as string[];

  for (const line of lines) {
    if (y > pageHeight - 54) {
      doc.addPage();
      y = marginTop;
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  }

  doc.save(`${fileBaseName(title, slug)}.pdf`);
}

export async function exportStudioDocument(params: {
  format: StudioExportFormat;
  markdown: string;
  title: string;
  slug: string;
}): Promise<void> {
  const { format, markdown, title, slug } = params;

  if (format === 'markdown') {
    exportMarkdown(markdown, title, slug);
    return;
  }

  if (format === 'txt') {
    exportText(markdown, title, slug);
    return;
  }

  await exportPdf(markdown, title, slug);
}
