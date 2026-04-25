# ADR 0002: URL scheme uses numeric primary key (`/n/<pk>`)

## Status
Accepted

## Context
The Reflex node-detail page needs a URL shape. Candidates: `/n/<pk>`, `/node/<pk>`, `/object/<slug>`, `/theseus/node/<id>`. The cosmos.gl canvas already encodes `Object.pk` as the point ID via `useGraphData.mapNode`. `ObjectViewSet.get_object()` (`apps/notebook/views/graph.py:95-106`) accepts numeric PK by default. The `Object` model does not currently carry a slug field that is unique across types.

## Decision
Use `/n/<pk>` where `<pk>` is the integer Object primary key. The host (`node.travisgilbert.me`) carries the semantic; the path stays tight.

## Consequences
- Zero backend change. `ObjectViewSet.get_object()` accepts the path identifier as-is.
- Stable URLs. PK never changes; titles do.
- The cosmos.gl point ID and the URL parameter are the same value, so the click-to-URL composition is a one-liner.
- Short, shareable URL.
- Numeric URLs are uglier than slug URLs. Acceptable for this personal-knowledge-graph aesthetic.
- Reversible: if we later add a unique `Object.slug` field, a parallel `/object/<slug>` route can resolve the same backend object and forward.
