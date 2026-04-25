# Stage 1: Reflex Skeleton + Dockerfile (Index-API repo)

Repo: `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/`

Outcome: A `reflex_node_detail/` directory in the Index-API repo containing a working Reflex app with five components, three pages, one state class, an HTTP client with a 30s TTL cache, a Dockerfile, a Railway TOML, and a tests directory that all pytest-passes locally. After this stage, `cd Index-API/reflex_node_detail && reflex run` boots the app on `:3000` and `curl localhost:3000/` returns 200.

All paths in this stage are in the Index-API repo. Do not commit any of these files from the Website repo. Always stage specific files, never `git add .`.

---

## Task 1: Scaffold reflex_node_detail directory + requirements

Goal: create the directory tree and the Python dependency manifest.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/rxconfig.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/requirements.txt`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/__init__.py` (empty)
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/pages/__init__.py` (empty)
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/state/__init__.py` (empty)
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/components/__init__.py` (empty)
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/tests/__init__.py` (empty)

Exact code for `rxconfig.py`:

```python
"""Reflex configuration for the Theseus Node Detail service."""

import os

import reflex as rx


config = rx.Config(
    app_name="reflex_node_detail",
    api_url=os.environ.get("REFLEX_API_URL", "http://localhost:8000"),
    db_url=os.environ.get("REFLEX_DB_URL", "sqlite:///reflex.db"),
    env=rx.Env.PROD if os.environ.get("REFLEX_ENV") == "prod" else rx.Env.DEV,
)
```

Exact code for `requirements.txt`:

```
reflex>=0.6,<1.0
httpx>=0.27,<1.0
pytest>=8.0,<9.0
pytest-asyncio>=0.23,<1.0
respx>=0.21,<1.0
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && python3 -m venv .venv && source .venv/bin/activate && pip install -q -r requirements.txt && python3 -c "import reflex, httpx, respx; print('ok')"
```

Acceptance criterion: import line prints `ok`. Directory tree matches the layout above.

Delegate to: django-engine-pro

---

## Task 2: Test + implement api_client.get_object

Goal: a thin async httpx wrapper with optional Bearer auth that fetches `/api/v1/notebook/objects/<pk>/`.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/api_client.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/tests/test_api_client.py`

Exact code for `api_client.py`:

```python
"""HTTP client for talking to the Index-API notebook endpoints.

Reads `RESEARCH_API_BASE_URL` for the host. Reads optional `INTERNAL_API_KEY`
to attach a Bearer header. Returns the parsed JSON dict, or raises an
httpx exception that the caller can map to an error state.
"""

from __future__ import annotations

import os
from typing import Any

import httpx


class ObjectNotFound(Exception):
    """Raised when the API returns 404 for a given pk."""


def _base_url() -> str:
    return os.environ.get("RESEARCH_API_BASE_URL", "http://localhost:8000").rstrip("/")


def _headers() -> dict[str, str]:
    key = os.environ.get("INTERNAL_API_KEY")
    if key:
        return {"Authorization": f"Bearer {key}"}
    return {}


async def get_object(pk: int) -> dict[str, Any]:
    """Fetch a single Object detail payload by integer pk."""
    url = f"{_base_url()}/api/v1/notebook/objects/{pk}/"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=_headers())
    if response.status_code == 404:
        raise ObjectNotFound(f"Object {pk} not found")
    response.raise_for_status()
    return response.json()
```

Exact code for `tests/test_api_client.py`:

```python
"""Tests for api_client.get_object."""

from __future__ import annotations

import os

import httpx
import pytest
import respx

from reflex_node_detail import api_client


pytestmark = pytest.mark.asyncio


@respx.mock
async def test_get_object_no_auth(monkeypatch):
    monkeypatch.setenv("RESEARCH_API_BASE_URL", "https://example.test")
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    route = respx.get("https://example.test/api/v1/notebook/objects/42/").mock(
        return_value=httpx.Response(200, json={"id": 42, "title": "Hello"}),
    )
    payload = await api_client.get_object(42)
    assert payload == {"id": 42, "title": "Hello"}
    assert route.called
    assert "Authorization" not in route.calls.last.request.headers


@respx.mock
async def test_get_object_with_auth(monkeypatch):
    monkeypatch.setenv("RESEARCH_API_BASE_URL", "https://example.test")
    monkeypatch.setenv("INTERNAL_API_KEY", "secret-token")
    route = respx.get("https://example.test/api/v1/notebook/objects/7/").mock(
        return_value=httpx.Response(200, json={"id": 7}),
    )
    payload = await api_client.get_object(7)
    assert payload == {"id": 7}
    assert route.calls.last.request.headers["Authorization"] == "Bearer secret-token"


@respx.mock
async def test_get_object_404_raises(monkeypatch):
    monkeypatch.setenv("RESEARCH_API_BASE_URL", "https://example.test")
    respx.get("https://example.test/api/v1/notebook/objects/9999/").mock(
        return_value=httpx.Response(404, json={"detail": "Not found."}),
    )
    with pytest.raises(api_client.ObjectNotFound):
        await api_client.get_object(9999)
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -m pytest tests/test_api_client.py -q
```

Acceptance criterion: 3 tests pass.

Delegate to: django-engine-pro

---

## Task 3: 30-second TTL cache on get_object

Goal: add an in-process dict cache so connection-to-connection navigation does not re-hit the API for 30 seconds.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/api_client.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/tests/test_api_client.py`

Replace the entire body of `api_client.py` with:

```python
"""HTTP client for talking to the Index-API notebook endpoints.

Reads `RESEARCH_API_BASE_URL` for the host. Reads optional `INTERNAL_API_KEY`
to attach a Bearer header. Returns the parsed JSON dict, or raises an
httpx exception that the caller can map to an error state.

Adds a 30 second TTL in-process cache keyed by pk so rapid connection
navigation does not re-hit the upstream API.
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx


CACHE_TTL_SECONDS = 30.0
_cache: dict[int, tuple[float, dict[str, Any]]] = {}


class ObjectNotFound(Exception):
    """Raised when the API returns 404 for a given pk."""


def _base_url() -> str:
    return os.environ.get("RESEARCH_API_BASE_URL", "http://localhost:8000").rstrip("/")


def _headers() -> dict[str, str]:
    key = os.environ.get("INTERNAL_API_KEY")
    if key:
        return {"Authorization": f"Bearer {key}"}
    return {}


def _cache_get(pk: int) -> dict[str, Any] | None:
    entry = _cache.get(pk)
    if entry is None:
        return None
    expires_at, payload = entry
    if time.time() > expires_at:
        _cache.pop(pk, None)
        return None
    return payload


def _cache_put(pk: int, payload: dict[str, Any]) -> None:
    _cache[pk] = (time.time() + CACHE_TTL_SECONDS, payload)


def cache_clear() -> None:
    """Test hook to drop all cached entries."""
    _cache.clear()


async def get_object(pk: int) -> dict[str, Any]:
    """Fetch a single Object detail payload by integer pk."""
    cached = _cache_get(pk)
    if cached is not None:
        return cached
    url = f"{_base_url()}/api/v1/notebook/objects/{pk}/"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=_headers())
    if response.status_code == 404:
        raise ObjectNotFound(f"Object {pk} not found")
    response.raise_for_status()
    payload = response.json()
    _cache_put(pk, payload)
    return payload
```

Append to the end of `tests/test_api_client.py`:

```python


@respx.mock
async def test_get_object_cache_hit(monkeypatch):
    monkeypatch.setenv("RESEARCH_API_BASE_URL", "https://example.test")
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    api_client.cache_clear()
    route = respx.get("https://example.test/api/v1/notebook/objects/3/").mock(
        return_value=httpx.Response(200, json={"id": 3, "title": "Cached"}),
    )
    first = await api_client.get_object(3)
    second = await api_client.get_object(3)
    assert first == second == {"id": 3, "title": "Cached"}
    assert route.call_count == 1


@respx.mock
async def test_get_object_cache_expires(monkeypatch):
    monkeypatch.setenv("RESEARCH_API_BASE_URL", "https://example.test")
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    api_client.cache_clear()
    route = respx.get("https://example.test/api/v1/notebook/objects/4/").mock(
        return_value=httpx.Response(200, json={"id": 4}),
    )
    await api_client.get_object(4)
    api_client._cache[4] = (0.0, {"id": 4, "stale": True})
    refreshed = await api_client.get_object(4)
    assert refreshed == {"id": 4}
    assert route.call_count == 2
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -m pytest tests/test_api_client.py -q
```

Acceptance criterion: 5 tests pass (3 from Task 2 + 2 new).

Delegate to: django-engine-pro

---

## Task 4: Test + implement compute_epistemic_weight pure function

Goal: a stateless function that mirrors `Object.epistemic_weight` from `apps/notebook/models/graph.py:770-805` so the Reflex page can render the score before the backend exposes it directly.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/epistemic_weight.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/tests/test_epistemic_weight.py`

Exact code for `epistemic_weight.py`:

```python
"""Pure-function port of `Object.epistemic_weight`.

Mirrors apps/notebook/models/graph.py:770-805. Kept as a standalone
function so the Reflex page can compute the value from a serializer
payload before the backend exposes it directly. Once
`ObjectDetailSerializer` ships an `epistemic_weight` field, the Reflex
page prefers that value and falls back to this function when missing.
"""

from __future__ import annotations

from typing import Any


CONTENT_WEIGHTS: dict[str, float] = {
    "acquaintance": 0.0,
    "propositional": 1.0,
    "procedural": 1.0,
    "explanatory": 1.2,
    "phenomenal": 0.8,
    "meta": 0.3,
    "axiomatic": 1.5,
}


def compute_epistemic_weight(payload: dict[str, Any]) -> float:
    """Return the epistemic weight for the given Object detail payload."""
    knowledge_content = payload.get("knowledge_content") or "propositional"
    is_hypothetical = bool(payload.get("is_hypothetical"))
    acceptance_status = payload.get("acceptance_status") or "accepted"

    weight = CONTENT_WEIGHTS.get(knowledge_content, 1.0)
    if is_hypothetical:
        weight *= 0.5
    if acceptance_status == "provisional":
        weight *= 0.4
    elif acceptance_status == "contested":
        weight *= 0.6
    elif acceptance_status == "retracted":
        weight = 0.0
    return weight
```

Exact code for `tests/test_epistemic_weight.py`:

```python
"""Tests for compute_epistemic_weight (mirror of model property)."""

from __future__ import annotations

import math

import pytest

from reflex_node_detail.epistemic_weight import compute_epistemic_weight


def _payload(**overrides):
    base = {
        "knowledge_content": "propositional",
        "is_hypothetical": False,
        "acceptance_status": "accepted",
    }
    base.update(overrides)
    return base


@pytest.mark.parametrize(
    "knowledge_content,expected",
    [
        ("acquaintance", 0.0),
        ("propositional", 1.0),
        ("procedural", 1.0),
        ("explanatory", 1.2),
        ("phenomenal", 0.8),
        ("meta", 0.3),
        ("axiomatic", 1.5),
    ],
)
def test_content_weights(knowledge_content, expected):
    assert compute_epistemic_weight(_payload(knowledge_content=knowledge_content)) == expected


def test_hypothetical_halves_weight():
    weight = compute_epistemic_weight(_payload(knowledge_content="explanatory", is_hypothetical=True))
    assert math.isclose(weight, 0.6)


def test_provisional_multiplies_by_0_4():
    weight = compute_epistemic_weight(_payload(acceptance_status="provisional"))
    assert math.isclose(weight, 0.4)


def test_contested_multiplies_by_0_6():
    weight = compute_epistemic_weight(_payload(acceptance_status="contested"))
    assert math.isclose(weight, 0.6)


def test_retracted_zeroes_weight():
    assert compute_epistemic_weight(_payload(acceptance_status="retracted")) == 0.0


def test_combined_axiomatic_hypothetical_provisional():
    weight = compute_epistemic_weight(
        _payload(
            knowledge_content="axiomatic",
            is_hypothetical=True,
            acceptance_status="provisional",
        )
    )
    assert math.isclose(weight, 1.5 * 0.5 * 0.4)


def test_unknown_content_falls_back_to_one():
    assert compute_epistemic_weight(_payload(knowledge_content="unmapped")) == 1.0


def test_missing_fields_use_defaults():
    assert compute_epistemic_weight({}) == 1.0
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -m pytest tests/test_epistemic_weight.py -q
```

Acceptance criterion: 13 parametrized + standalone tests pass.

Delegate to: django-engine-pro

---

## Task 5: NodeState (rx.State) loader

Goal: an `rx.State` subclass that reads the `pk` route param, calls `api_client.get_object`, and exposes `data`, `is_loading`, `error`.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/state/node_state.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/tests/test_node_state.py`

Exact code for `state/node_state.py`:

```python
"""NodeState: loads one Object detail payload for /n/<pk>."""

from __future__ import annotations

from typing import Any

import httpx
import reflex as rx

from reflex_node_detail import api_client


class NodeState(rx.State):
    """Per-page state for /n/<pk>."""

    pk: str = ""
    data: dict[str, Any] = {}
    is_loading: bool = False
    error: str = ""

    @rx.var
    def has_data(self) -> bool:
        return bool(self.data) and not self.error

    @rx.var
    def not_found(self) -> bool:
        return self.error == "not_found"

    async def load(self):
        """Reflex on_load handler: read pk from router params and fetch."""
        raw_pk = self.router.page.params.get("pk", "")
        self.pk = str(raw_pk)
        self.error = ""
        self.data = {}
        if not self.pk.isdigit():
            self.error = "invalid_pk"
            return
        self.is_loading = True
        try:
            self.data = await api_client.get_object(int(self.pk))
        except api_client.ObjectNotFound:
            self.error = "not_found"
        except (httpx.HTTPError, httpx.TimeoutException):
            self.error = "unreachable"
        finally:
            self.is_loading = False

    async def retry(self):
        await self.load()
```

Exact code for `tests/test_node_state.py`:

```python
"""Tests for NodeState.load behaviour against a stubbed api_client.

Reflex state classes use a metaclass; direct __init__ may not be safe
in a bare unit test. We exercise the load coroutine as an unbound
function against a SimpleNamespace stand in that mirrors the
attributes the method actually touches.
"""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest

from reflex_node_detail import api_client
from reflex_node_detail.state import node_state as state_mod


pytestmark = pytest.mark.asyncio


def _stub(params):
    return SimpleNamespace(
        pk="",
        data={},
        is_loading=False,
        error="",
        router=SimpleNamespace(page=SimpleNamespace(params=params)),
    )


async def test_load_success(monkeypatch):
    api_client.cache_clear()

    async def fake_get(pk):
        assert pk == 5
        return {"id": 5, "title": "Hi"}

    monkeypatch.setattr(api_client, "get_object", fake_get)
    inst = _stub({"pk": "5"})
    await state_mod.NodeState.load(inst)
    assert inst.data == {"id": 5, "title": "Hi"}
    assert inst.error == ""
    assert inst.is_loading is False
    assert inst.pk == "5"


async def test_load_not_found(monkeypatch):
    api_client.cache_clear()

    async def fake_get(pk):
        raise api_client.ObjectNotFound(f"missing {pk}")

    monkeypatch.setattr(api_client, "get_object", fake_get)
    inst = _stub({"pk": "9999"})
    await state_mod.NodeState.load(inst)
    assert inst.error == "not_found"
    assert inst.data == {}


async def test_load_unreachable(monkeypatch):
    api_client.cache_clear()

    async def fake_get(pk):
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(api_client, "get_object", fake_get)
    inst = _stub({"pk": "12"})
    await state_mod.NodeState.load(inst)
    assert inst.error == "unreachable"


async def test_load_invalid_pk(monkeypatch):
    api_client.cache_clear()
    inst = _stub({"pk": "abc"})
    await state_mod.NodeState.load(inst)
    assert inst.error == "invalid_pk"
    assert inst.data == {}
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -m pytest tests/test_node_state.py -q
```

Acceptance criterion: 4 tests pass.

Delegate to: django-engine-pro

---

## Task 6: Pages skeleton: node.py with placeholder

Goal: register the `/n/[pk]` route with Reflex and render a minimal skeleton that the section tasks fill in.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/pages/node.py`
- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/reflex_node_detail.py`

Exact code for `pages/node.py`:

```python
"""/n/<pk> page: full node detail surface."""

from __future__ import annotations

import reflex as rx

from reflex_node_detail.state.node_state import NodeState


def _loading_skeleton() -> rx.Component:
    return rx.vstack(
        rx.box(width="60%", height="32px", background="#e5e1d8", border_radius="4px"),
        rx.box(width="100%", height="120px", background="#efece4", border_radius="4px"),
        rx.box(width="100%", height="240px", background="#efece4", border_radius="4px"),
        spacing="4",
        padding="32px",
        width="100%",
    )


def _placeholder_body() -> rx.Component:
    return rx.box(
        rx.text("Node detail loaded.", font_family="Vollkorn, serif", font_size="20px"),
        padding="32px",
    )


def node_page() -> rx.Component:
    return rx.cond(
        NodeState.is_loading,
        _loading_skeleton(),
        _placeholder_body(),
    )
```

Exact code for `reflex_node_detail.py`:

```python
"""Reflex app entry. Registers all pages."""

from __future__ import annotations

import reflex as rx

from reflex_node_detail.pages.node import node_page
from reflex_node_detail.state.node_state import NodeState


app = rx.App()
app.add_page(node_page, route="/n/[pk]", on_load=NodeState.load, title="Theseus Node")
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && timeout 15 reflex run --env dev > /tmp/reflex_smoke.log 2>&1 & SERVER_PID=$!; sleep 10; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/n/1; kill $SERVER_PID 2>/dev/null; wait 2>/dev/null
```

Acceptance criterion: `reflex run` starts without import errors and curl on `/n/1` returns a 2xx (not necessarily 200; Reflex may serve via 30x redirect during compile). The smoke is "no Python tracebacks in `/tmp/reflex_smoke.log`."

Delegate to: django-engine-pro

---

## Task 7: Home page (/)

Goal: an honest landing page with a single sentence and one outbound link to the Explorer. No mock data, no fake search.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/pages/home.py`

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/reflex_node_detail.py`

Exact code for `pages/home.py`:

```python
"""/ : honest landing page. Points users to the Explorer."""

from __future__ import annotations

import reflex as rx


def home_page() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.heading(
                "Theseus Node Detail",
                font_family="Vollkorn, serif",
                size="6",
            ),
            rx.text(
                "Open a node from the Explorer.",
                font_family="Cabin, sans-serif",
                color="#5b554c",
            ),
            rx.link(
                "Go to the Explorer.",
                href="https://travisgilbert.me/theseus/explorer",
                color="#2D5F6B",
                font_family="Cabin, sans-serif",
                is_external=True,
            ),
            spacing="3",
            align="center",
        ),
        padding="64px 24px",
        min_height="100vh",
        background="#f8f5ec",
    )
```

Replace the entire body of `reflex_node_detail.py`:

```python
"""Reflex app entry. Registers all pages."""

from __future__ import annotations

import reflex as rx

from reflex_node_detail.pages.home import home_page
from reflex_node_detail.pages.node import node_page
from reflex_node_detail.state.node_state import NodeState


app = rx.App()
app.add_page(home_page, route="/", title="Theseus Node Detail")
app.add_page(node_page, route="/n/[pk]", on_load=NodeState.load, title="Theseus Node")
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "from reflex_node_detail.reflex_node_detail import app; print(sorted(app.pages.keys()))"
```

Acceptance criterion: prints a list containing both `/` and `/n/[pk]`. No tracebacks.

Delegate to: django-engine-pro

---

## Task 8: Not-found component

Goal: a centered "Object not found" empty state used by `/n/<pk>` when `NodeState.error == 'not_found'`.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/pages/not_found.py`

Exact code:

```python
"""Centered empty state: rendered inside /n/<pk> when the pk does not resolve."""

from __future__ import annotations

import reflex as rx


def not_found_view() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.heading(
                "Object not found.",
                font_family="Vollkorn, serif",
                size="5",
                color="#3a342c",
            ),
            rx.text(
                "The requested node is not in the engine.",
                font_family="Cabin, sans-serif",
                color="#5b554c",
            ),
            rx.link(
                "Back to Explorer.",
                href="https://travisgilbert.me/theseus/explorer",
                color="#2D5F6B",
                font_family="Cabin, sans-serif",
                is_external=True,
            ),
            spacing="3",
            align="center",
        ),
        padding="96px 24px",
        min_height="100vh",
        background="#f8f5ec",
    )
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "from reflex_node_detail.pages.not_found import not_found_view; not_found_view(); print('ok')"
```

Acceptance criterion: prints `ok`. No import or render errors.

Delegate to: django-engine-pro

---

## Task 9: Header component

Goal: render title, type chip, body excerpt (first 280 chars), metadata strip (created_at relative, updated_at, acceptance_status, hypothetical badge), and a Back-to-Explorer link.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/components/header.py`

Exact code:

```python
"""Header section for the /n/<pk> page.

Renders title, type chip (colored per CommonPlace section color language),
body excerpt, metadata strip, hypothetical badge, and a back to explorer
link. No OpenGraph / share image markup (see design doc section 10).
"""

from __future__ import annotations

from datetime import datetime, timezone

import reflex as rx

from reflex_node_detail.state.node_state import NodeState


TYPE_COLORS = {
    "source": "#2D5F6B",
    "hunch": "#C49A4A",
    "quote": "#B45A2D",
    "concept": "#5A7A4A",
    "note": "#9A8E82",
}


def _excerpt(body: str, limit: int = 280) -> str:
    if not body:
        return ""
    if len(body) <= limit:
        return body
    return body[: limit - 1].rstrip() + "."


def _relative(iso: str) -> str:
    if not iso:
        return ""
    try:
        when = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return iso
    delta = datetime.now(timezone.utc) - when
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return "just now"
    if seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    if seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = seconds // 86400
    return f"{days} day{'s' if days != 1 else ''} ago"


def header_view() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.hstack(
                rx.heading(
                    NodeState.data.get("display_title", NodeState.data.get("title", "")),
                    font_family="Vollkorn, serif",
                    size="7",
                    color="#3a342c",
                ),
                rx.cond(
                    NodeState.data.get("is_hypothetical", False),
                    rx.badge(
                        "Hypothetical",
                        color_scheme="orange",
                        font_family="Cabin, sans-serif",
                    ),
                    rx.fragment(),
                ),
                spacing="3",
                align="center",
            ),
            rx.hstack(
                rx.badge(
                    NodeState.data.get("object_type_data", {}).get("slug", "object"),
                    background=NodeState.data.get("object_type_data", {}).get("color", "#9A8E82"),
                    color="white",
                    font_family="Cabin, sans-serif",
                ),
                rx.text(
                    "Acceptance: ",
                    NodeState.data.get("acceptance_status", "accepted"),
                    font_family="Cabin, sans-serif",
                    color="#5b554c",
                    font_size="14px",
                ),
                rx.text(
                    "Created ",
                    _relative(NodeState.data.get("created_at", "")),
                    font_family="Cabin, sans-serif",
                    color="#5b554c",
                    font_size="14px",
                ),
                rx.text(
                    "Updated ",
                    _relative(NodeState.data.get("updated_at", "")),
                    font_family="Cabin, sans-serif",
                    color="#5b554c",
                    font_size="14px",
                ),
                spacing="4",
                align="center",
                wrap="wrap",
            ),
            rx.text(
                _excerpt(NodeState.data.get("body", "")),
                font_family="Vollkorn, serif",
                color="#3a342c",
                font_size="16px",
                line_height="1.6",
            ),
            rx.link(
                "Back to Explorer.",
                href=f"https://travisgilbert.me/theseus/explorer?focus={NodeState.pk}",
                color="#2D5F6B",
                font_family="Cabin, sans-serif",
                font_size="14px",
                is_external=True,
            ),
            spacing="3",
            align="start",
            width="100%",
        ),
        padding="32px 32px 16px",
        width="100%",
        max_width="960px",
        margin="0 auto",
    )
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "from reflex_node_detail.components.header import header_view, _excerpt, _relative; assert _excerpt('a' * 300).endswith('.'); assert _relative('') == ''; print('ok')"
```

Acceptance criterion: prints `ok`. `_excerpt` truncates correctly. No import errors.

Delegate to: django-engine-pro

---

## Task 10: Epistemic weight component

Goal: render a large numeric, a horizontal gauge clamped to [0.0, 1.5], and a four-row decomposition table (knowledge_content, acceptance_status, is_hypothetical, pagerank). Footnote line shows "Computed live from engine state at <updated_at>."

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/components/epistemic_weight.py`

Exact code:

```python
"""Section A: Epistemic weight."""

from __future__ import annotations

import reflex as rx

from reflex_node_detail.epistemic_weight import compute_epistemic_weight
from reflex_node_detail.state.node_state import NodeState


def _weight_value(data: dict) -> float:
    explicit = data.get("epistemic_weight")
    if isinstance(explicit, (int, float)):
        return float(explicit)
    return compute_epistemic_weight(data)


def _gauge(value: float) -> rx.Component:
    clamped = max(0.0, min(value, 1.5))
    pct = (clamped / 1.5) * 100.0
    return rx.box(
        rx.box(
            width=f"{pct:.1f}%",
            height="100%",
            background="#2D5F6B",
            border_radius="4px",
        ),
        width="100%",
        height="8px",
        background="#e5e1d8",
        border_radius="4px",
    )


def _row(label: str, source_field: str, value: str, contribution: str) -> rx.Component:
    return rx.hstack(
        rx.text(label, font_family="Cabin, sans-serif", color="#3a342c", font_size="14px", width="200px"),
        rx.text(source_field, font_family="JetBrains Mono, monospace", color="#5b554c", font_size="12px", width="220px"),
        rx.text(value, font_family="Cabin, sans-serif", color="#3a342c", font_size="14px", width="200px"),
        rx.text(contribution, font_family="Cabin, sans-serif", color="#5b554c", font_size="14px"),
        spacing="3",
        padding="8px 0",
        border_bottom="1px solid #e5e1d8",
        width="100%",
    )


def epistemic_weight_view() -> rx.Component:
    weight = _weight_value(NodeState.data)
    knowledge = NodeState.data.get("knowledge_content", "propositional")
    acceptance = NodeState.data.get("acceptance_status", "accepted")
    is_hypothetical = NodeState.data.get("is_hypothetical", False)
    pagerank = NodeState.data.get("pagerank", 0.0)
    updated_at = NodeState.data.get("updated_at", "")

    return rx.box(
        rx.vstack(
            rx.heading(
                "Epistemic weight",
                font_family="Vollkorn, serif",
                size="5",
                color="#3a342c",
            ),
            rx.hstack(
                rx.text(
                    f"{weight:.2f}",
                    font_family="Vollkorn, serif",
                    font_size="48px",
                    color="#3a342c",
                ),
                rx.box(_gauge(weight), width="240px"),
                spacing="4",
                align="center",
            ),
            _row("knowledge_content", "Object.knowledge_content", str(knowledge), "base"),
            _row("acceptance_status", "Object.acceptance_status", str(acceptance), "multiplier"),
            _row("is_hypothetical", "Object.is_hypothetical", str(is_hypothetical), "x0.5 if true"),
            _row("pagerank", "Object.pagerank", f"{pagerank:.4f}" if isinstance(pagerank, (int, float)) else "0.0000", "shown alongside"),
            rx.text(
                f"Computed live from engine state at {updated_at}.",
                font_family="JetBrains Mono, monospace",
                color="#7a7268",
                font_size="11px",
            ),
            spacing="3",
            align="start",
            width="100%",
        ),
        padding="24px 32px",
        background="#fefcf6",
        border="1px solid #e5e1d8",
        border_radius="8px",
        width="100%",
        max_width="960px",
        margin="0 auto",
    )
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "from reflex_node_detail.components.epistemic_weight import _weight_value; assert _weight_value({'epistemic_weight': 1.2}) == 1.2; assert _weight_value({'knowledge_content': 'axiomatic'}) == 1.5; print('ok')"
```

Acceptance criterion: prints `ok`. `_weight_value` prefers explicit field, falls back to computed.

Delegate to: django-engine-pro

---

## Task 11: Contributors component

Goal: render four labeled subgroups (Promoted source, Timeline contributors, Claim evidence sources, Engines) composed client-side from the existing serializer payload. Engines collapsed into pill chips.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/components/contributors.py`

Exact code:

```python
"""Section B: Contributors. Composed client-side from the serializer payload."""

from __future__ import annotations

from collections import Counter

import reflex as rx

from reflex_node_detail.state.node_state import NodeState


def _timeline_contributors(data: dict) -> list[tuple[str, int]]:
    nodes = data.get("recent_nodes", []) or []
    raw = [n.get("created_by") for n in nodes if n.get("created_by")]
    counts = Counter(raw)
    return sorted(counts.items(), key=lambda kv: -kv[1])


def _claim_sources(data: dict) -> list[dict]:
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
    engines: set[str] = set()
    for conn in data.get("connections", []) or []:
        engine = conn.get("engine")
        if engine:
            engines.add(engine)
    return sorted(engines)


def _subgroup_label(text: str) -> rx.Component:
    return rx.text(
        text,
        font_family="Courier Prime, monospace",
        color="#7a7268",
        font_size="11px",
        text_transform="uppercase",
        letter_spacing="0.08em",
    )


def _promoted_source_block(data: dict) -> rx.Component:
    promoted = data.get("promoted_source") or {}
    if not promoted:
        return rx.fragment()
    title = promoted.get("title") or promoted.get("name") or "Promoted source"
    url = promoted.get("url") or ""
    return rx.vstack(
        _subgroup_label("Promoted source"),
        rx.cond(
            bool(url),
            rx.link(title, href=url, color="#2D5F6B", font_family="Cabin, sans-serif", is_external=True),
            rx.text(title, font_family="Cabin, sans-serif", color="#3a342c"),
        ),
        spacing="1",
        align="start",
    )


def _timeline_block(data: dict) -> rx.Component:
    rows = _timeline_contributors(data)
    if not rows:
        return rx.fragment()
    return rx.vstack(
        _subgroup_label("Timeline contributors"),
        rx.foreach(
            rows,
            lambda row: rx.hstack(
                rx.text(row[0], font_family="Cabin, sans-serif", color="#3a342c"),
                rx.badge(str(row[1]), color_scheme="gray"),
                spacing="2",
            ),
        ),
        spacing="1",
        align="start",
    )


def _claim_evidence_block(data: dict) -> rx.Component:
    rows = _claim_sources(data)
    if not rows:
        return rx.fragment()
    return rx.vstack(
        _subgroup_label("Claim evidence sources"),
        rx.foreach(
            rows,
            lambda row: rx.text(
                f"Artifact #{row['artifact_id']}: {row['reason'] or row['relation_type']}",
                font_family="Cabin, sans-serif",
                color="#3a342c",
                font_size="14px",
            ),
        ),
        spacing="1",
        align="start",
    )


def _engines_block(data: dict) -> rx.Component:
    engines = _engines(data)
    if not engines:
        return rx.fragment()
    return rx.vstack(
        _subgroup_label("Engines"),
        rx.hstack(
            rx.foreach(
                engines,
                lambda eng: rx.badge(eng, color_scheme="teal", font_family="JetBrains Mono, monospace"),
            ),
            spacing="2",
            wrap="wrap",
        ),
        spacing="1",
        align="start",
    )


def contributors_view() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.heading(
                "Contributors",
                font_family="Vollkorn, serif",
                size="5",
                color="#3a342c",
            ),
            _promoted_source_block(NodeState.data),
            _timeline_block(NodeState.data),
            _claim_evidence_block(NodeState.data),
            _engines_block(NodeState.data),
            spacing="4",
            align="start",
            width="100%",
        ),
        padding="24px 32px",
        background="#fefcf6",
        border="1px solid #e5e1d8",
        border_radius="8px",
        width="100%",
        max_width="960px",
        margin="0 auto",
    )
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "
from reflex_node_detail.components.contributors import _timeline_contributors, _claim_sources, _engines
assert _timeline_contributors({'recent_nodes': [{'created_by': 'a'}, {'created_by': 'a'}, {'created_by': 'b'}]}) == [('a', 2), ('b', 1)]
assert _claim_sources({'object_claims': [{'evidence_links': [{'artifact_id': 1, 'reason': 'x'}, {'artifact_id': 1}]}]}) == [{'artifact_id': 1, 'relation_type': '', 'reason': 'x'}]
assert _engines({'connections': [{'engine': 'sbert'}, {'engine': 'spacy'}, {}]}) == ['sbert', 'spacy']
print('ok')
"
```

Acceptance criterion: prints `ok`. All three composition helpers behave correctly.

Delegate to: django-engine-pro

---

## Task 12: Connections component (top 12, recursive nav)

Goal: render top 12 connections by strength as a two-column list. Each row: edge type badge, other-side title linked to `/n/<other_pk>`, strength gauge, reason (truncated 140 chars), engine pill (when present). The "View all N connections" expander is rendered but disabled until `?connections=full` ships (Stage 3 task 26).

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/components/connections.py`

Exact code:

```python
"""Section C: Connections. Top 12 by edge strength.

Each row links the other-side title to /n/<other_pk> for recursive
Reflex navigation. The expander is rendered disabled until the
?connections=full backend support ships.
"""

from __future__ import annotations

import reflex as rx

from reflex_node_detail.state.node_state import NodeState


EDGE_TYPE_COLORS = {
    "supports": "#5A7A4A",
    "contradicts": "#B45A2D",
    "similar_to": "#2D5F6B",
    "cites": "#C49A4A",
    "imports": "#3a342c",
    "calls": "#3a342c",
    "inherits": "#3a342c",
    "has_member": "#3a342c",
}


def _truncate(text: str, limit: int = 140) -> str:
    if not text:
        return ""
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "."


def _other_pk(connected_id: str) -> str:
    if connected_id and connected_id.startswith("object:"):
        return connected_id.split(":", 1)[1]
    return ""


def _row(conn: dict) -> rx.Component:
    connected = conn.get("connected_object", {}) or {}
    edge_type = conn.get("edge_type", "related")
    color = EDGE_TYPE_COLORS.get(edge_type, "#9A8E82")
    other_pk = _other_pk(connected.get("id", ""))
    strength = conn.get("strength", 0.0) or 0.0
    pct = max(0.0, min(float(strength), 1.0)) * 100.0
    reason = _truncate(conn.get("explanation", ""))
    engine = conn.get("engine") or ""

    return rx.hstack(
        rx.badge(edge_type, background=color, color="white", font_family="JetBrains Mono, monospace"),
        rx.vstack(
            rx.link(
                connected.get("title", "[deleted]"),
                href=f"/n/{other_pk}",
                color="#3a342c",
                font_family="Vollkorn, serif",
                font_size="15px",
                _hover={"color": "#2D5F6B"},
            ),
            rx.text(reason, font_family="Cabin, sans-serif", color="#5b554c", font_size="13px"),
            spacing="1",
            align="start",
        ),
        rx.box(
            rx.box(width=f"{pct:.1f}%", height="100%", background="#2D5F6B", border_radius="3px"),
            width="80px",
            height="6px",
            background="#e5e1d8",
            border_radius="3px",
        ),
        rx.cond(
            engine != "",
            rx.badge(engine, color_scheme="gray", font_family="JetBrains Mono, monospace"),
            rx.fragment(),
        ),
        spacing="3",
        align="start",
        padding="8px 0",
        border_bottom="1px solid #e5e1d8",
        width="100%",
    )


def connections_view() -> rx.Component:
    return rx.box(
        rx.vstack(
            rx.heading(
                "Connections",
                font_family="Vollkorn, serif",
                size="5",
                color="#3a342c",
            ),
            rx.foreach(
                NodeState.data.get("connections", [])[:12],
                _row,
            ),
            rx.button(
                "View all connections.",
                is_disabled=True,
                title="Available once the backend exposes the full connections list.",
                font_family="Cabin, sans-serif",
                color_scheme="gray",
                variant="outline",
            ),
            spacing="2",
            align="start",
            width="100%",
        ),
        padding="24px 32px",
        background="#fefcf6",
        border="1px solid #e5e1d8",
        border_radius="8px",
        width="100%",
        max_width="960px",
        margin="0 auto",
    )
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "
from reflex_node_detail.components.connections import _truncate, _other_pk
assert _truncate('a' * 200).endswith('.')
assert _other_pk('object:42') == '42'
assert _other_pk('') == ''
print('ok')
"
```

Acceptance criterion: prints `ok`. Truncation and pk extraction behave.

Delegate to: django-engine-pro

---

## Task 13: Provenance footer component

Goal: render three small links right-aligned: "Open in Explorer", "View raw JSON", "Permalink" (copy to clipboard).

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/components/provenance.py`

Exact code:

```python
"""Section D: Provenance footer. Three small links right aligned."""

from __future__ import annotations

import reflex as rx

from reflex_node_detail.state.node_state import NodeState


class ProvenanceClipboard(rx.State):
    """Holds the small piece of state for the permalink copy action."""

    copied: bool = False

    async def copy_permalink(self):
        permalink = f"https://node.travisgilbert.me/n/{NodeState.pk}"
        await rx.set_clipboard(permalink)
        self.copied = True


def provenance_view() -> rx.Component:
    return rx.flex(
        rx.spacer(),
        rx.hstack(
            rx.link(
                "Open in Explorer.",
                href=f"https://travisgilbert.me/theseus/explorer?focus={NodeState.pk}",
                color="#5b554c",
                font_family="Cabin, sans-serif",
                font_size="13px",
                is_external=True,
            ),
            rx.link(
                "View raw JSON.",
                href=f"https://index-api-production-a5f7.up.railway.app/api/v1/notebook/objects/{NodeState.pk}/",
                color="#5b554c",
                font_family="Cabin, sans-serif",
                font_size="13px",
                is_external=True,
            ),
            rx.button(
                rx.cond(ProvenanceClipboard.copied, "Copied.", "Permalink."),
                on_click=ProvenanceClipboard.copy_permalink,
                variant="ghost",
                color_scheme="gray",
                font_family="Cabin, sans-serif",
                font_size="13px",
            ),
            spacing="4",
            align="center",
        ),
        padding="16px 32px 32px",
        width="100%",
        max_width="960px",
        margin="0 auto",
    )
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "from reflex_node_detail.components.provenance import provenance_view, ProvenanceClipboard; provenance_view(); print('ok')"
```

Acceptance criterion: prints `ok`. No import errors.

Delegate to: django-engine-pro

---

## Task 14: Wire pages/node.py to render the five sections + error and loading states

Goal: replace the placeholder body with the five sections in order. Render `not_found_view` when `error == 'not_found'`. Render an "unreachable" centered banner with a retry button when `error == 'unreachable'` or `error == 'invalid_pk'`.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/reflex_node_detail/pages/node.py`

Replace the entire body of `pages/node.py` with:

```python
"""/n/<pk> page: full node detail surface.

Renders five sections in order: header, epistemic weight, contributors,
connections, provenance footer. Empty / error states are honest:
not-found uses the centered not_found_view; unreachable / invalid_pk
uses an inline banner with a retry button that re-runs NodeState.load.
"""

from __future__ import annotations

import reflex as rx

from reflex_node_detail.components.connections import connections_view
from reflex_node_detail.components.contributors import contributors_view
from reflex_node_detail.components.epistemic_weight import epistemic_weight_view
from reflex_node_detail.components.header import header_view
from reflex_node_detail.components.provenance import provenance_view
from reflex_node_detail.pages.not_found import not_found_view
from reflex_node_detail.state.node_state import NodeState


def _loading_skeleton() -> rx.Component:
    return rx.vstack(
        rx.box(width="60%", height="32px", background="#e5e1d8", border_radius="4px"),
        rx.box(width="100%", height="120px", background="#efece4", border_radius="4px"),
        rx.box(width="100%", height="240px", background="#efece4", border_radius="4px"),
        spacing="4",
        padding="32px",
        max_width="960px",
        margin="0 auto",
        width="100%",
    )


def _error_banner() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.heading(
                "Could not reach the engine.",
                font_family="Vollkorn, serif",
                size="5",
                color="#3a342c",
            ),
            rx.text(
                "Try again in a moment.",
                font_family="Cabin, sans-serif",
                color="#5b554c",
            ),
            rx.button(
                "Retry.",
                on_click=NodeState.retry,
                color_scheme="teal",
                font_family="Cabin, sans-serif",
            ),
            rx.link(
                "Back to Explorer.",
                href="https://travisgilbert.me/theseus/explorer",
                color="#2D5F6B",
                font_family="Cabin, sans-serif",
                is_external=True,
            ),
            spacing="3",
            align="center",
        ),
        padding="96px 24px",
        min_height="100vh",
        background="#f8f5ec",
    )


def _full_surface() -> rx.Component:
    return rx.vstack(
        header_view(),
        epistemic_weight_view(),
        contributors_view(),
        connections_view(),
        provenance_view(),
        spacing="5",
        padding="32px 0 64px",
        background="#f8f5ec",
        min_height="100vh",
        width="100%",
    )


def node_page() -> rx.Component:
    return rx.cond(
        NodeState.is_loading,
        _loading_skeleton(),
        rx.cond(
            NodeState.not_found,
            not_found_view(),
            rx.cond(
                NodeState.error != "",
                _error_banner(),
                _full_surface(),
            ),
        ),
    )
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -c "from reflex_node_detail.pages.node import node_page; node_page(); print('ok')"
```

Acceptance criterion: prints `ok`. All five components import cleanly inside the page.

Delegate to: django-engine-pro

---

## Task 15: Dockerfile.reflex

Goal: a Dockerfile that produces a runnable Reflex container suitable for Railway. Python 3.11 base, copies the directory, installs requirements, exposes `$PORT`.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/Dockerfile.reflex`

Exact code:

```dockerfile
# Reflex node detail service for Theseus.
# Build context: the reflex_node_detail/ directory.

FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    REFLEX_ENV=prod

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
        unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY . /app

# Reflex needs to compile the frontend on first boot. Pre warm so
# Railway health checks don't time out on the first request.
RUN reflex init || true

EXPOSE 3000 8000

CMD ["sh", "-c", "reflex run --env prod --backend-port ${PORT:-8000} --frontend-port ${PORT:-3000}"]
```

Verification command:

```bash
docker --version && cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && docker build -f Dockerfile.reflex -t reflex-node-detail:smoke .
```

Acceptance criterion: build succeeds and produces a tagged image. If `docker` is unavailable on the dev machine, mark this verification as deferred and rely on Railway's build during Stage 4.

Delegate to: django-engine-pro

---

## Task 16: railway.reflex.toml

Goal: a Railway TOML that selects `Dockerfile.reflex` and registers a healthcheck path.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/railway.reflex.toml`

Exact code:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "reflex_node_detail/Dockerfile.reflex"

[deploy]
startCommand = "cd reflex_node_detail && reflex run --env prod --backend-port $PORT --frontend-port $PORT"
restartPolicyType = "always"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyMaxRetries = 3
```

Verification command:

```bash
python3 -c "import tomllib, pathlib; tomllib.loads(pathlib.Path('/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/railway.reflex.toml').read_text()); print('ok')"
```

Acceptance criterion: prints `ok` (TOML parses).

Delegate to: django-engine-pro

---

## Task 17: README + manual local smoke

Goal: a tiny README that lists the local commands, plus a manual local smoke that proves `/` and `/n/1` both render.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail/README.md`

Exact code for README:

```markdown
# reflex_node_detail

Reflex service that renders the Theseus per-node detail page.

## Local development

```
cd reflex_node_detail
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
RESEARCH_API_BASE_URL=https://index-api-production-a5f7.up.railway.app reflex run --env dev
```

Open `http://localhost:3000/` for the landing page and `http://localhost:3000/n/<pk>` for any Object pk.

## Tests

```
cd reflex_node_detail
source .venv/bin/activate
python3 -m pytest tests/ -q
```

## Production build

```
docker build -f Dockerfile.reflex -t reflex-node-detail:local .
docker run --rm -p 3000:3000 -p 8000:8000 \
  -e RESEARCH_API_BASE_URL=https://index-api-production-a5f7.up.railway.app \
  -e REFLEX_API_URL=http://localhost:8000 \
  reflex-node-detail:local
```
```

Manual smoke (run after tests pass):

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && RESEARCH_API_BASE_URL=https://index-api-production-a5f7.up.railway.app reflex run --env dev > /tmp/reflex_smoke.log 2>&1 & SERVER_PID=$!; sleep 20; HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/); NODE_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/n/1); kill $SERVER_PID 2>/dev/null; wait 2>/dev/null; echo "home=$HOME_CODE node=$NODE_CODE"
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/reflex_node_detail" && source .venv/bin/activate && python3 -m pytest tests/ -q
```

Acceptance criterion: pytest passes for all three test files. Manual smoke prints both `home=2xx` and `node=2xx` (or 30x during compile, but no 5xx). README file exists.

Delegate to: django-engine-pro

---

## Stage 1 exit criteria

All of the following must be true before moving to Stage 2:

- `python3 -m pytest tests/ -q` passes (12+ tests across `test_api_client.py`, `test_epistemic_weight.py`, `test_node_state.py`).
- `python3 -c "from reflex_node_detail.reflex_node_detail import app"` runs without error.
- Both `/` and `/n/1` return non-5xx status codes from a local `reflex run` smoke.
- `railway.reflex.toml` parses as TOML.
- `Dockerfile.reflex` exists at the expected path (build can be verified locally if Docker is installed; otherwise verified during Stage 4 in Railway's pipeline).
- All new files are staged with explicit `git add <path>` (never `git add .`); no other Index-API files are accidentally included.
