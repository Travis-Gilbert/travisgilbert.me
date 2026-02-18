/**
 * Shared types for the reader comments feature.
 */

export interface Comment {
  id: string;
  article_slug: string;
  content_type: 'essays' | 'field-notes';
  paragraph_index: number;
  author_name: string;
  body: string;
  is_flagged: boolean;
  created_at: string;
}

export type ContentType = 'essays' | 'field-notes';
