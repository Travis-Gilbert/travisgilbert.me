# Studio v4: Video Production in Studio

> **For Claude Code.** Depends on v3, v3.1, v3.2 specs fully complete.
> No em dashes. Run `npm run build` after each batch.

## Five batches bringing video production into the Studio frontend:

```
Batch 0: Video editor page (route, API types, VideoEditor component, phase stepper, scene list, next action card)
Batch 1: Script editor (Tiptap with scene-typed ContainBlocks, /scene /visual /needs-source slash commands)
Batch 2: Session tracking UI (start/stop timer, end session form with subtask checkboxes, session log in WorkbenchPanel)
Batch 3: TickTick Video Breakdown sync (batch-create 8 phase tasks with scene subtasks on project init)
Batch 4: Evidence Board (structured Clue/Source/Confidence/NextAction/Visual table in WorkbenchPanel, pull-from-research-thread)
```

## Key architectural decisions:

- Reuses existing Django API endpoints (VideoProject CRUD, next-action, advance, log-session) verbatim
- Phase stepper reuses StageStepper.tsx with VIDEO_PHASES instead of STAGES, locked phases get lock icon
- Script editor uses the same Tiptap setup as essays, adding 'scene' to CONTAIN_TYPES for scene-level containment
- Session tracking talks directly to the Django API, no intermediate state management layer
- TickTick sync uses httpx from Django (server-to-server), not MCP tools
- Evidence Board maps to the mystery-structure reference from the scriptwriter skill
- TickTick project: Video Breakdown (696d539b8f08e340f3116156), naming: 🎬 [Title] - P[#]: [Phase]

Full implementation spec with all code, CSS, Django model changes, and verification checklists in the downloadable STUDIO_V4_VIDEO_PRODUCTION_SPEC.md.
