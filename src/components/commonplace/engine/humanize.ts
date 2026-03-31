import type { EngineLogEntry } from '@/lib/commonplace-models';

/**
 * Transforms engine log entries into human-readable first-person sentences.
 * Used by the collapsed bar and Ask tab greeting.
 */

export function humanizeLogEntry(entry: EngineLogEntry): string {
  const msg = entry.message;

  switch (entry.pass) {
    case 'sbert': {
      const embedMatch = msg.match(/(\d+)\s*(?:evidence\s+)?embeddings/i);
      const pairMatch = msg.match(/(\d+)\s*new\s+high/i);
      const embedCount = embedMatch?.[1] ?? 'several';
      const pairCount = pairMatch?.[1] ?? 'a few';
      return `I computed ${embedCount} embeddings and found ${pairCount} new high-similarity pairs.`;
    }
    case 'nli': {
      const hasContradiction = /contradiction/i.test(msg);
      const stance = hasContradiction ? 'disagree' : 'agree';
      const topicMatch = msg.match(/vs\s+A\d+/);
      const topic = topicMatch ? 'this claim' : 'a recent finding';
      return `Two of your sources ${stance} about ${topic}. I've flagged this.`;
    }
    case 'kge': {
      const entityMatch = msg.match(/['"]([^'"]+)['"]/);
      const countMatch = msg.match(/(\d+)\s*existing/i);
      const entity = entityMatch?.[1] ?? 'an entity';
      const count = countMatch?.[1] ?? 'several';
      return `I linked ${entity} to ${count} existing objects in the graph.`;
    }
    case 'stress': {
      const driftMatch = msg.match(/([-\d.]+)%/);
      const findingsMatch = msg.match(/(\d+)\s*(?:high|findings)/i);
      const drift = driftMatch?.[1] ?? '0';
      const findings = findingsMatch?.[1] ?? '0';
      return `Stress test finished. Drift is ${drift}%. ${findings} findings need attention.`;
    }
    case 'promote': {
      const countMatch = msg.match(/(\d+)\s*candidates/i);
      const count = countMatch?.[1] ?? 'New';
      return `${count} new connection candidates are ready for your review.`;
    }
    default:
      return msg;
  }
}

const IDLE_THOUGHTS = [
  (s: { objects: number; edges: number }) =>
    `I'm watching ${s.objects} objects and ${s.edges} edges. Everything looks stable.`,
  (s: { objects: number }) =>
    `${s.objects} objects in the graph. I'll flag anything interesting.`,
  () => 'Listening for new activity. Ask me anything about your knowledge graph.',
  (s: { edges: number }) =>
    `${s.edges} connections mapped so far. I'm looking for patterns.`,
  () => "All quiet. I'll surface anything worth your attention.",
];

export function generateIdleThought(stats: {
  objects: number;
  edges: number;
}): string {
  // Rotate through idle thoughts based on timestamp
  const index = Math.floor(Date.now() / 5000) % IDLE_THOUGHTS.length;
  return IDLE_THOUGHTS[index](stats);
}
