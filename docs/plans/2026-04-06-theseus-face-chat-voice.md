# Theseus Face, Chat, and Voice: Validated Design

**Date:** 2026-04-06
**Status:** Validated via brainstorming session
**Original spec:** SPEC-THESEUS-FACE-CHAT-VOICE.md (with significant revisions below)

## Core Concept

Three interconnected capabilities for the /ask page: a stippled face as the galaxy's idle state, a spatially-anchored conversation surface rendered on the galaxy canvas, and bidirectional voice with sentence-level TTS streaming.

## Key Design Decisions (from brainstorming)

These override the original spec where they differ:

### 1. Face IS the idle state of the galaxy (not a side element)

The original spec placed the face in the "center-left 40%." The validated design: **the face dominates the full center of the screen as the home/landing state.** Input bar at bottom. Sidebar ambient dot animations as texture. The face is the hero of the idle screen.

When a question is asked, the face's dots get recruited by the StipplingDirector into the answer visualization. The face becomes the answer because they are the same dots transitioning from one stippling target to another. No dissolve animation needed; it's the same system in a different state.

### 2. Galaxy IS the conversation surface (Option C)

The original spec proposed a 45/55 split with a right-side chat panel. The validated design: **there is no fixed panel.** The galaxy canvas IS the conversation surface.

Three tiers of response rendering:

- **Inline responses** (short, contextual): Rendered directly on the canvas using pretext, positioned near relevant node clusters. Dots clear space via spring physics as text appears.
- **Focused panels** (long, structured): Canvas-rendered panels bloom from the relevant node cluster when the response is substantial (code blocks, evidence chains, multi-paragraph). Still spatially anchored, still within the galaxy. DOM overlay positioned to match canvas coordinates for text selection, links, code highlighting.
- **Conversation history**: Previous exchanges persist as collapsed cards at their spatial positions. The galaxy becomes a spatial map of the conversation.

**Threshold rule:** Response starts streaming inline on canvas. If it exceeds ~3 sentences, it graduates into a DOM panel at the same position.

**Panels are spatially anchored:** When a user clicks a node, the detail panel blooms FROM that location. Panels are physics-aware and fluid, not docked to a fixed edge. They reposition smoothly when the galaxy rearranges.

### 3. assistant-ui primitives (deconstructed) + reference architectures

Not using assistant-ui as a boxed component library. Using its decomposed primitives (`ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`) for streaming state management and message threading, wrapped in VIE surfaces.

Reference architectures to study (not import):
- **LibreChat**: Inline tool output rendering, conversation forking, artifact system
- **LobeChat**: Voice integration patterns (TTS/STT flow), visual polish, agent group UX

VIE chrome (glass panels, Sonner toasts, Vaul drawers, CMDK) provides the visual layer. assistant-ui primitives provide the plumbing.

### 4. Voice: Direct-to-Deepgram with token endpoint

The original spec routed STT through a Django WebSocket proxy. The validated design: **Django issues a short-lived Deepgram API token via a REST endpoint, then the browser opens a WebSocket directly to Deepgram.** Less infrastructure, lower latency, no need for Django Channels.

- **STT:** Deepgram Nova-3, browser-direct WebSocket after token exchange
- **TTS:** Cartesia Sonic (40ms TTFA), sentence-level streaming (not length-limited)
- **Sentence-level streaming** means: as soon as the LLM generates the first sentence, send it to Cartesia. Audio plays within ~40ms. Second sentence queues seamlessly. The user hears continuous speech while the LLM is still generating.

### 5. Voice avatar during conversation

When the user activates the microphone or TTS is playing during an active answer visualization, a **small stippled face** (~80x80px) appears in a corner with mouth animation. This is a compact canvas-rendered element, not a DOM overlay. The full-canvas face only exists in the idle state.

### 6. Panel surface design (current panels look bad)

The existing VIE panel colors (`rgba(15, 16, 18, 0.76)` on `#0f1012` background) are flat and muddy. New panel surfaces need better contrast against the dark ground. This will be addressed during implementation (new VIE surface tokens for spatial panels).

### 7. Stippling is sacred

Every visual state goes through the stipple pipeline. The face, the answer visualization, the idle galaxy, even the corner voice avatar. The StipplingEngine -> DotGrid path is the ONLY rendering path. Nothing bypasses it. DOM overlays exist only for text interactivity (selection, links) on top of the stippled surface, never as replacements for it.

## Architecture

### State Machine

```
IDLE (face as hero, input bar at bottom)
  -> user types or speaks
THINKING (face dots begin recruiting into answer model)
  -> LLM generates response
CONSTRUCTING (5-phase answer build: galaxy, filtering, construction, crystallization, exploration)
  -> answer stabilizes
EXPLORING (inline text + spatial panels, interactive nodes)
  -> user asks follow-up
THINKING (answer dots rearrange for new question)
  -> ...
```

### Rendering Pipeline (unchanged, extended)

```
SceneDirective / TheseusAvatar (what to render)
  -> Semantic Renderers (visual canvas + ID map)
  -> StipplingEngine (Lloyd's relaxation -> dot positions)
  -> DotGrid (interactive presentation)
  -> pretextLabels (canvas text at dot-cleared regions)
  -> DOM overlay (optional, for selectable text in focused panels)
```

### New Modules

| Module | Purpose |
|--------|---------|
| `src/lib/galaxy/TheseusAvatar.ts` | Generates face density map as offscreen canvas |
| `src/lib/galaxy/FaceAnimator.ts` | Mouth (amplitude-driven), blink, breathing controllers |
| `src/lib/galaxy/SpatialConversation.ts` | Manages spatial positions of inline text and panel blooms |
| `src/lib/voice/DeepgramSTT.ts` | Token exchange + browser-direct WebSocket to Deepgram |
| `src/lib/voice/CartesiaTTS.ts` | Sentence-level streaming, Web Audio playback, AnalyserNode |
| `src/lib/voice/VoiceManager.ts` | Coordinates STT/TTS state, feeds amplitude to FaceAnimator |
| `src/components/ask/AskPage.tsx` | Full-screen galaxy with face idle state, input bar |
| `src/components/ask/SpatialPanel.tsx` | Physics-aware panel that blooms from clicked node position |
| `src/components/ask/VoiceControls.tsx` | Microphone button, voice settings |
| `src/components/ask/InlineResponse.tsx` | Canvas-rendered streaming text near relevant clusters |

### Modified Modules

| Module | Change |
|--------|--------|
| `StipplingDirector.ts` | Add face idle as a stipple target mode |
| `pretextLabels.ts` | Extend for inline conversation text (larger blocks, streaming) |
| `DotGrid.tsx` | Spring physics: dots clear space for inline text regions |

### Backend (Django / Index-API)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/voice/token` | Issue short-lived Deepgram API token |
| `POST /api/v1/voice/tts` | Proxy text to Cartesia Sonic, stream audio chunks back |

TTS endpoint streams sentence-by-sentence. No WebSocket needed for TTS (chunked HTTP response). STT is browser-direct to Deepgram after token exchange.

## Face Design

### Aesthetic

90s retro-futuristic. Low-resolution geometric face formed from the same 0/1 data dots as the ambient grid. Think Tamagotchi, Happy Mac, robot emoji. The face is a density pattern in the data, not an overlay.

### Density Map

TheseusAvatar generates a grayscale density map:
- Eyes: dark circles (high dot density)
- Mouth: dark horizontal band
- Nose bridge: subtle dark line
- Jawline: medium dark contour
- Interior: very light (sparse dots)
- Background: white (blends into ambient grid)

### Idle Animations

- Breathing: all face dots shift up/down 1-2px on 4s sine wave
- Blink: eye dots compress vertically for ~200ms, every 4-8s (randomized)
- 0/1 values continue cycling

### Transition States

- Idle -> Speaking: mouth animates via amplitude, face dots brighten (teal accent)
- Idle -> Listening: sonar pulse radiates outward from face
- Idle -> Thinking: face dots begin migrating toward answer positions
- Answer -> Idle: dots drift back into face formation

### Mouth Animation

Approach A (fast, recommended): After initial stipple, tag ~40-80 lip-region dots. During speech, displace their Y positions based on AnalyserNode amplitude. Upper lip up, lower lip down. Max displacement ~15px. Smoothed with lerp factor 0.3.

## Voice Flow

### STT Flow

1. User clicks mic (or keyboard shortcut)
2. Frontend calls `POST /api/v1/voice/token` to get short-lived Deepgram key
3. Browser opens WebSocket directly to Deepgram Nova-3
4. MediaStream captures audio, streams to Deepgram
5. Interim transcripts appear in input (lighter color, updating)
6. Final transcript solidifies
7. Auto-send after configurable pause (default 2s), or user edits and sends manually

### TTS Flow

1. LLM generates response via SSE/streaming
2. First complete sentence detected
3. Sentence sent to `POST /api/v1/voice/tts` (Cartesia Sonic)
4. Audio chunks stream back, play via Web Audio API (gapless chaining)
5. AnalyserNode feeds amplitude to FaceAnimator mouth
6. Text renders inline on galaxy canvas, synchronized with audio

### Proactive Greeting

Pre-generated greeting audio shipped as static asset (`public/audio/greeting.mp3`). On first visit: face assembles from dots (~2s), then greeting plays with mouth animation. Text appears inline on canvas below the face. Zero LLM latency.

## Implementation Phases

### Phase 1: Face + Idle State
- TheseusAvatar.ts (density map generation)
- Wire into StipplingDirector as idle target
- Face construction animation (dots converge ~2s)
- Idle animations (breathing, blink)
- Full-screen face as home/landing state with input bar

### Phase 2: Spatial Conversation Surface
- SpatialConversation.ts (position management)
- Inline response rendering via extended pretextLabels
- SpatialPanel bloom from node click positions
- DOM overlay for focused panels (text selection, links)
- Threshold logic (inline -> panel graduation at ~3 sentences)
- Conversation history as collapsed spatial cards

### Phase 3: Voice
- Deepgram token endpoint (Django)
- DeepgramSTT.ts (browser-direct WebSocket)
- Cartesia TTS endpoint (Django, chunked streaming)
- CartesiaTTS.ts (sentence-level playback, AnalyserNode)
- VoiceManager state coordination
- Wire amplitude to FaceAnimator mouth
- Pre-generated greeting audio

### Phase 4: Polish
- Thinking state (face dots migrating to answer positions)
- Listening state (sonar pulse)
- Gaze direction (eye dots shift toward active region)
- Corner voice avatar during answer exploration
- Voice settings UI (localStorage)
- Mobile: compact face banner, full-width conversation
- New panel surface tokens (replace muddy rgba colors)

## Non-Goals (deferred)

- Realistic facial expressions beyond mouth/blink
- Multiple voice personas
- Video/camera input
- Collaborative multi-user conversation
- Full canvas text selection (DOM overlay handles this)
