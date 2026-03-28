'use client';

import styles from './ObjectRef.module.css';

interface ObjectRefProps {
  id: number;
  title: string;
  typeSlug: string;
  typeColor: string;
  onClick?: (id: number) => void;
}

export default function ObjectRef({ id, title, typeSlug, typeColor, onClick }: ObjectRefProps) {
  return (
    <span
      className={styles.ref}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(id); }}
      title={`${typeSlug}: ${title}`}
    >
      <span className={styles.dot} style={{ background: typeColor, width: 6, height: 6 }} />
      {title}
    </span>
  );
}
