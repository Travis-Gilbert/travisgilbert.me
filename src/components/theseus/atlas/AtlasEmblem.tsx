'use client';

/** Atlas sidebar emblem — Theseus PCB mark + wordmark + volume eyebrow. */
export default function AtlasEmblem() {
  return (
    <div className="atlas-emblem">
      <img className="mark" src="/theseus-emblem.svg" alt="" aria-hidden="true" />
      <span className="name">Theseus</span>
      <span className="vol">Vol · III</span>
    </div>
  );
}
