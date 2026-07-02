/**
 * FIXTURE (HANDOFF-CODE-SURFACE-UI D10). This is stand-in data for the
 * pre-action preview strip; the engine that emits real ActionCandidates is
 * another spec. Every rendering of this data must carry a visible "fixture"
 * tag: fixture data announces itself, always.
 */

export interface ActionCandidate {
  kind: 'click' | 'type' | 'scroll';
  selector: string;
  label: string;
  confidence: number;
  screenshotRegion: null;
}

export const ACTION_CANDIDATE_FIXTURE: ActionCandidate[] = [
  {
    kind: 'click',
    selector: 'button[data-testid="submit-order"]',
    label: 'Submit the order form',
    confidence: 0.92,
    screenshotRegion: null,
  },
  {
    kind: 'type',
    selector: 'input[name="search"]',
    label: 'Type the search query',
    confidence: 0.81,
    screenshotRegion: null,
  },
  {
    kind: 'click',
    selector: 'a[rel="next"]',
    label: 'Open the next results page',
    confidence: 0.67,
    screenshotRegion: null,
  },
  {
    kind: 'scroll',
    selector: 'main section:last-of-type',
    label: 'Scroll to the pricing table',
    confidence: 0.58,
    screenshotRegion: null,
  },
];
