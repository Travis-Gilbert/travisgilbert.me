'use client';

import { useState } from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
}

export default function YouTubeEmbed({
  videoId,
  title = 'YouTube video',
}: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);

  // Don't render anything if no video ID is provided
  if (!videoId) return null;

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full aspect-video rounded"
      />
    );
  }

  return (
    <div
      className="relative aspect-video bg-ink/5 rounded overflow-hidden cursor-pointer group"
      onClick={() => setPlaying(true)}
      role="button"
      tabIndex={0}
      aria-label={`Play: ${title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setPlaying(true);
        }
      }}
    >
      {/* Thumbnail */}
      <img
        src={thumbnailUrl}
        alt={`Play: ${title}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-ink/20 group-hover:bg-ink/30 transition-colors">
        <svg
          className="w-16 h-16 text-paper drop-shadow-lg"
          viewBox="0 0 68 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74 0.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
            fill="currentColor"
            opacity="0.85"
          />
          <path d="M45 24L27 14v20l18-10z" fill="var(--color-ink)" />
        </svg>
      </div>
    </div>
  );
}
