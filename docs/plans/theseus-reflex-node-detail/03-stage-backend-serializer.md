# Stage 3: Backend Serializer Enrichment (Index-API repo)

Repo: `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/`

Outcome: `ObjectDetailSerializer` exposes a server-authoritative `epistemic_weight` float and a composed `contributors` object. `ObjectViewSet.retrieve` accepts a `?connections=full` query param that bumps the connections cap from 20 to 50. Reflex page prefers the new fields when present and falls back to the client-side compute.

This stage touches `apps/notebook/serializers.py` and `apps/notebook/views/graph.py`. A Django import smoke is mandatory before pushing (per MEMORY.md). Stage specific files only; never `git add .`.

---

## Task 24: Add epistemic_weight to ObjectDetailSerializer

Goal: expose the existing `Object.epistemic_weight` model property (`apps/notebook/models/graph.py:770-805`) as a serializer field on `ObjectDetailSerializer`. Add it to the `fields` Meta list and as a class-level `FloatField(read_only=True, source='epistemic_weight')`.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/apps/notebook/serializers.py`

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/apps/notebook/tests/test_object_detail_serializer.py`

Step 1: in `serializers.py`, locate the `ObjectDetailSerializer` class declaration block (starts at line ~492). Add the field declaration directly under the existing `connection_count = serializers.IntegerField(source='edge_count', read_only=True)` line:

```python
    epistemic_weight = serializers.FloatField(read_only=True)
```

(DRF reads `Object.epistemic_weight` via attribute access on the model instance; the `@property` on `Object` returns the float. No explicit `source` needed because the field name matches the attribute name.)

Step 2: in the same `Meta.fields` list, add `'epistemic_weight'` directly after `'is_hypothetical',`. The updated tuple line should read:

```python
            'knowledge_content', 'justification_source', 'is_hypothetical', 'epistemic_weight',
```

Step 3: create the test file with the following exact content:

```python
"""Smoke tests for ObjectDetailSerializer additions in Stage 3."""

from __future__ import annotations

import pytest

from apps.notebook.models import Object, ObjectType
from apps.notebook.serializers import ObjectDetailSerializer


@pytest.mark.django_db
def test_epistemic_weight_present_for_propositional_accepted():
    object_type, _ = ObjectType.objects.get_or_create(
        slug="note", defaults={"name": "Note", "color": "#9A8E82"},
    )
    obj = Object.objects.create(
        title="Stage 3 weight smoke",
        object_type=object_type,
        knowledge_content="propositional",
        acceptance_status="accepted",
        is_hypothetical=False,
    )
    payload = ObjectDetailSerializer(obj).data
    assert "epistemic_weight" in payload
    assert payload["epistemic_weight"] == 1.0


@pytest.mark.django_db
def test_epistemic_weight_zero_for_retracted():
    object_type, _ = ObjectType.objects.get_or_create(
        slug="note", defaults={"name": "Note", "color": "#9A8E82"},
    )
    obj = Object.objects.create(
        title="Retracted",
        object_type=object_type,
        knowledge_content="propositional",
        acceptance_status="retracted",
    )
    payload = ObjectDetailSerializer(obj).data
    assert payload["epistemic_weight"] == 0.0
```

Verification command (Django import smoke + test):

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API" && DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); from apps.notebook.serializers import ObjectDetailSerializer; assert 'epistemic_weight' in ObjectDetailSerializer.Meta.fields; print('ok')" && python3 -m pytest apps/notebook/tests/test_object_detail_serializer.py::test_epistemic_weight_present_for_propositional_accepted apps/notebook/tests/test_object_detail_serializer.py::test_epistemic_weight_zero_for_retracted -q
```

Acceptance criterion: import smoke prints `ok`; both pytest tests pass.

Delegate to: django-engine-pro

---

## Task 25: Add composed contributors SerializerMethodField

Goal: add a `contributors` SerializerMethodField on `ObjectDetailSerializer` that returns a dict with `promoted_source`, `timeline_users`, `claim_sources`, `engines`. Day-1 server composition mirrors the client-side composition in Stage 1 task 11.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/apps/notebook/serializers.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/apps/notebook/tests/test_object_detail_serializer.py`

Step 1: in `serializers.py`, add the field declaration directly under the new `epistemic_weight` line from Task 24:

```python
    contributors = serializers.SerializerMethodField()
```

Step 2: add `'contributors'` to the `Meta.fields` list directly after `'object_claims',`. The updated tail of the tuple should read:

```python
            'object_claims', 'contributors',
```

Step 3: add the method body inside `ObjectDetailSerializer`, directly after the existing `get_object_claims` method:

```python
    def get_contributors(self, obj):
        """Composed contributor groups for the Reflex node detail page.

        Day 1: mirror the client side composition. Includes promoted
        source identity, timeline node author counts, distinct claim
        evidence artifact ids, and the set of engines that produced
        edges on this object.
        """
        from collections import Counter

        promoted = obj.promoted_source
        promoted_payload = None
        if promoted is not None:
            promoted_payload = {
                "id": promoted.pk,
                "title": getattr(promoted, "title", None) or getattr(promoted, "name", ""),
                "url": getattr(promoted, "url", "") or "",
            }

        nodes = obj.timeline_nodes.order_by("-occurred_at")[:30]
        timeline_users = [
            {"name": name, "count": count}
            for name, count in Counter(
                n.created_by for n in nodes if n.created_by
            ).most_common()
        ]

        claim_sources: list[dict] = []
        seen_artifacts: set[int] = set()
        for claim in obj.claims.prefetch_related("evidence_links")[:30]:
            for link in claim.evidence_links.all()[:10]:
                if link.artifact_id and link.artifact_id not in seen_artifacts:
                    seen_artifacts.add(link.artifact_id)
                    claim_sources.append({
                        "artifact_id": link.artifact_id,
                        "relation_type": link.relation_type or "",
                        "reason": link.reason or "",
                    })

        engines: set[str] = set()
        for edge in list(obj.edges_out.all()) + list(obj.edges_in.all()):
            if edge.engine:
                engines.add(edge.engine)

        return {
            "promoted_source": promoted_payload,
            "timeline_users": timeline_users,
            "claim_sources": claim_sources,
            "engines": sorted(engines),
        }
```

Step 4: append a new test to `test_object_detail_serializer.py`:

```python


@pytest.mark.django_db
def test_contributors_shape_smoke():
    object_type, _ = ObjectType.objects.get_or_create(
        slug="note", defaults={"name": "Note", "color": "#9A8E82"},
    )
    obj = Object.objects.create(
        title="Contributors smoke",
        object_type=object_type,
        knowledge_content="propositional",
        acceptance_status="accepted",
    )
    payload = ObjectDetailSerializer(obj).data
    contributors = payload.get("contributors")
    assert contributors is not None
    assert set(contributors.keys()) == {
        "promoted_source",
        "timeline_users",
        "claim_sources",
        "engines",
    }
    assert contributors["promoted_source"] is None
    assert contributors["timeline_users"] == []
    assert contributors["claim_sources"] == []
    assert contributors["engines"] == []
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API" && DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); from apps.notebook.serializers import ObjectDetailSerializer; assert 'contributors' in ObjectDetailSerializer.Meta.fields; print('ok')" && python3 -m pytest apps/notebook/tests/test_object_detail_serializer.py -q
```

Acceptance criterion: import smoke prints `ok`; all three serializer tests pass.

Delegate to: django-engine-pro

---

## Task 26: Add ?connections=full query param to ObjectViewSet.retrieve

Goal: when the request includes `?connections=full`, the connections cap in `ObjectDetailSerializer.get_connections` bumps from 20 to 50. Implementation passes the cap through serializer context.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/apps/notebook/views/graph.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/apps/notebook/serializers.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/apps/notebook/tests/test_object_detail_serializer.py`

Step 1: in `apps/notebook/views/graph.py`, locate the `ObjectViewSet` class and add a `get_serializer_context` override directly after the existing `get_serializer_class` method:

```python
    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'retrieve':
            full = self.request.query_params.get('connections') == 'full'
            context['connections_cap'] = 50 if full else 20
        return context
```

Step 2: in `apps/notebook/serializers.py`, replace the body of `ObjectDetailSerializer.get_connections` with:

```python
    def get_connections(self, obj):
        cap = self.context.get('connections_cap', 20)
        all_edges = list(obj.edges_out.all()) + list(obj.edges_in.all())
        all_edges.sort(key=lambda e: e.strength or 0, reverse=True)
        top_edges = all_edges[:cap]
        return _safe_serialize_many(
            ObjectConnectionSerializer, top_edges, {'current_object_id': obj.pk}, obj.pk, 'Connection',
        )
```

Step 3: append a new test to `test_object_detail_serializer.py`:

```python


@pytest.mark.django_db
def test_connections_cap_default_is_20():
    object_type, _ = ObjectType.objects.get_or_create(
        slug="note", defaults={"name": "Note", "color": "#9A8E82"},
    )
    obj = Object.objects.create(
        title="Cap default",
        object_type=object_type,
        knowledge_content="propositional",
        acceptance_status="accepted",
    )
    serializer = ObjectDetailSerializer(obj, context={})
    assert serializer.get_connections(obj) == []


@pytest.mark.django_db
def test_connections_cap_full_is_50():
    object_type, _ = ObjectType.objects.get_or_create(
        slug="note", defaults={"name": "Note", "color": "#9A8E82"},
    )
    obj = Object.objects.create(
        title="Cap full",
        object_type=object_type,
        knowledge_content="propositional",
        acceptance_status="accepted",
    )
    serializer = ObjectDetailSerializer(obj, context={"connections_cap": 50})
    assert serializer.get_connections(obj) == []
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API" && DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); from apps.notebook.views.graph import ObjectViewSet; vs = ObjectViewSet(); print('ok')" && python3 -m pytest apps/notebook/tests/test_object_detail_serializer.py -q
```

Acceptance criterion: import smoke prints `ok`; all five serializer tests pass.

Delegate to: django-engine-pro

---

## Task 27: Reflex page prefers server fields with client fallback

Goal: in the Reflex repo, `epistemic_weight.py` and `contributors.py` already prefer the server-side fields when present (Stage 1 already wrote `_weight_value` to prefer `payload['epistemic_weight']`). This task verifies the Stage 1 helpers continue to do the right thing once the server adds the new fields, and adds tests that exercise both the server-present and server-missing branches.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/components/contributors.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/tests/test_epistemic_weight.py`

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/tests/test_contributors_fallback.py`

Step 1: update `contributors.py` so each subgroup helper prefers the server `payload['contributors']` when present, falling back to the client composition. Replace the existing `_timeline_contributors`, `_claim_sources`, and `_engines` functions with these versions:

```python
def _server(data: dict) -> dict | None:
    contrib = data.get("contributors")
    if isinstance(contrib, dict):
        return contrib
    return None


def _timeline_contributors(data: dict) -> list[tuple[str, int]]:
    server = _server(data)
    if server is not None:
        rows = server.get("timeline_users") or []
        return [(r["name"], r["count"]) for r in rows]
    nodes = data.get("recent_nodes", []) or []
    raw = [n.get("created_by") for n in nodes if n.get("created_by")]
    counts = Counter(raw)
    return sorted(counts.items(), key=lambda kv: -kv[1])


def _claim_sources(data: dict) -> list[dict]:
    server = _server(data)
    if server is not None:
        return list(server.get("claim_sources") or [])
    seen: dict[int, dict] = {}
    for claim in data.get("object_claims", []) or []:
        for link in claim.get("evidence_links", []) or []:
            artifact_id = link.get("artifact_id")
            if artifact_id is not None and artifact_id not in seen:
                seen[artifact_id] = {
                    "artifact_id": artifact_id,
                    "relation_type": link.get("relation_type", ""),
                    "reason": link.get("reason", ""),
                }
    return list(seen.values())


def _engines(data: dict) -> list[str]:
    server = _server(data)
    if server is not None:
        return list(server.get("engines") or [])
    engines: set[str] = set()
    for conn in data.get("connections", []) or []:
        engine = conn.get("engine")
        if engine:
            engines.add(engine)
    return sorted(engines)
```

Step 2: append a test to `tests/test_epistemic_weight.py` that proves explicit server-side `epistemic_weight` is preferred:

```python


def test_explicit_field_takes_precedence_over_computed():
    payload = {
        "knowledge_content": "axiomatic",
        "is_hypothetical": False,
        "acceptance_status": "accepted",
        "epistemic_weight": 0.42,
    }
    from reflex_node_detail.components.epistemic_weight import _weight_value
    assert _weight_value(payload) == 0.42
```

Step 3: create the new fallback test file:

```python
"""Tests covering the server vs client fallback paths in contributors.py."""

from __future__ import annotations

from reflex_node_detail.components.contributors import (
    _claim_sources,
    _engines,
    _timeline_contributors,
)


def test_timeline_uses_server_field_when_present():
    payload = {
        "contributors": {"timeline_users": [{"name": "alice", "count": 3}]},
        "recent_nodes": [{"created_by": "bob"}, {"created_by": "bob"}],
    }
    assert _timeline_contributors(payload) == [("alice", 3)]


def test_timeline_falls_back_to_client_composition():
    payload = {
        "recent_nodes": [{"created_by": "bob"}, {"created_by": "bob"}, {"created_by": "carol"}],
    }
    assert _timeline_contributors(payload) == [("bob", 2), ("carol", 1)]


def test_claim_sources_uses_server_field_when_present():
    payload = {
        "contributors": {"claim_sources": [{"artifact_id": 9, "reason": "from server"}]},
        "object_claims": [{"evidence_links": [{"artifact_id": 1}]}],
    }
    assert _claim_sources(payload) == [{"artifact_id": 9, "reason": "from server"}]


def test_claim_sources_falls_back_to_client_composition():
    payload = {"object_claims": [{"evidence_links": [{"artifact_id": 1}]}]}
    assert _claim_sources(payload) == [{"artifact_id": 1, "relation_type": "", "reason": ""}]


def test_engines_uses_server_field_when_present():
    payload = {
        "contributors": {"engines": ["sbert", "kge"]},
        "connections": [{"engine": "spacy"}],
    }
    assert _engines(payload) == ["sbert", "kge"]


def test_engines_falls_back_to_client_composition():
    payload = {"connections": [{"engine": "sbert"}, {"engine": "spacy"}]}
    assert _engines(payload) == ["sbert", "spacy"]
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -m pytest tests/ -q
```

Acceptance criterion: all Reflex tests pass (including the new explicit-field test in `test_epistemic_weight.py` and the six tests in `test_contributors_fallback.py`).

Delegate to: django-engine-pro

---

## Stage 3 exit criteria

Before pushing the Index-API repo:

- Django import smoke passes: `DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); import apps.notebook.models; from apps.notebook.serializers import ObjectDetailSerializer; from apps.notebook.views.graph import ObjectViewSet; print('ok')"`.
- All notebook tests for this feature pass: `python3 -m pytest apps/notebook/tests/test_object_detail_serializer.py -q`.
- All Reflex tests still pass (Stage 1 + Stage 3 additions): `cd reflex_node_detail && python3 -m pytest tests/ -q`.
- Only the files listed in this stage are staged for commit. Run `git status` immediately before commit and verify nothing else from the noisy working tree is included.
