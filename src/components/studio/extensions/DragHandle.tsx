import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

const dragHandlePluginKey = new PluginKey('dragHandle');

/* ── Position helpers ────────────────────────── */

/** Find the top-level block node at a given document position. */
function resolveBlockAt(
  view: EditorView,
  pos: number,
): { node: ProseMirrorNode; pos: number } | null {
  try {
    const $pos = view.state.doc.resolve(pos);
    if ($pos.depth < 1) return null;
    const nodePos = $pos.before(1);
    const node = view.state.doc.nodeAt(nodePos);
    if (!node) return null;
    return { node, pos: nodePos };
  } catch {
    return null;
  }
}

/** Find the nearest block boundary (top-level) for a drop target. */
function nearestDropTarget(
  view: EditorView,
  y: number,
): { pos: number; side: 'before' | 'after' } | null {
  const { doc } = view.state;
  let best: { pos: number; side: 'before' | 'after'; dist: number } | null =
    null;

  doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();

    /* Check distance to top edge (insert before) */
    const distBefore = Math.abs(y - rect.top);
    if (!best || distBefore < best.dist) {
      best = { pos: offset, side: 'before', dist: distBefore };
    }

    /* Check distance to bottom edge (insert after) */
    const distAfter = Math.abs(y - rect.bottom);
    if (distAfter < best!.dist) {
      best = {
        pos: offset + node.nodeSize,
        side: 'after',
        dist: distAfter,
      };
    }
  });

  return best;
}

/* ── Drop indicator DOM ──────────────────────── */

let dropIndicator: HTMLElement | null = null;

function showDropIndicator(
  view: EditorView,
  targetPos: number,
  side: 'before' | 'after',
) {
  const { doc } = view.state;

  let refDom: HTMLElement | null = null;

  if (side === 'before') {
    refDom = view.nodeDOM(targetPos) as HTMLElement | null;
  } else {
    /* For 'after', targetPos points after the node; walk back */
    try {
      const $pos = doc.resolve(targetPos);
      const beforePos = $pos.before($pos.depth);
      refDom = view.nodeDOM(beforePos) as HTMLElement | null;
    } catch {
      refDom = null;
    }
  }

  if (!refDom || !(refDom instanceof HTMLElement)) {
    hideDropIndicator();
    return;
  }

  if (!dropIndicator) {
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'studio-drop-indicator';
    document.body.appendChild(dropIndicator);
  }

  const rect = refDom.getBoundingClientRect();
  const editorRect = view.dom.getBoundingClientRect();
  const topY = side === 'before' ? rect.top : rect.bottom;

  dropIndicator.style.top = `${topY - 1}px`;
  dropIndicator.style.left = `${editorRect.left}px`;
  dropIndicator.style.width = `${editorRect.width}px`;
  dropIndicator.style.display = 'block';
}

function hideDropIndicator() {
  if (dropIndicator) {
    dropIndicator.style.display = 'none';
  }
}

function cleanupDropIndicator() {
  if (dropIndicator) {
    dropIndicator.remove();
    dropIndicator = null;
  }
}

/* ── Grip icon builder (safe DOM, no innerHTML) ─ */

function buildGripIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 10 14');
  svg.setAttribute('fill', 'currentColor');

  const dots = [
    [3, 2],
    [7, 2],
    [3, 7],
    [7, 7],
    [3, 12],
    [7, 12],
  ];
  for (const [cx, cy] of dots) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', '1.2');
    svg.appendChild(c);
  }

  return svg;
}

/* ── Extension ───────────────────────────────── */

/**
 * Floating drag handle for block reordering.
 *
 * Architecture: a single body-mounted element repositioned via mousemove.
 * This avoids ProseMirror Decoration.widget sibling DOM issues and
 * overflow:hidden clipping on .studio-page.
 */
const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let dragSourcePos: number | null = null;
    let isDragging = false;
    let handleEl: HTMLElement | null = null;
    let activeBlockPos: number | null = null;
    let currentView: EditorView | null = null;
    let scrollContainer: HTMLElement | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    /** Delay hiding to bridge the gap between editor DOM and handle. */
    function scheduleHide() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        hideHandle();
        hideTimer = null;
      }, 280);
    }

    function cancelHide() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    /* ── Handle element lifecycle ────────────── */

    function createHandle(): HTMLElement {
      const el = document.createElement('div');
      el.className = 'studio-drag-handle';
      el.contentEditable = 'false';
      el.draggable = true;
      el.appendChild(buildGripIcon());

      /* Direct listeners (handle is body-mounted, outside view.dom) */
      el.addEventListener('mousedown', onHandleMousedown);
      el.addEventListener('dragstart', onHandleDragstart);
      el.addEventListener('dragend', onHandleDragend);
      el.addEventListener('mouseenter', () => {
        cancelHide();
        if (el) el.style.opacity = '1';
      });
      el.addEventListener('mouseleave', () => {
        scheduleHide();
      });

      document.body.appendChild(el);
      return el;
    }

    function positionHandle(view: EditorView, blockPos: number) {
      if (!handleEl) handleEl = createHandle();

      const dom = view.nodeDOM(blockPos);
      if (!(dom instanceof HTMLElement)) {
        handleEl.style.opacity = '0';
        handleEl.style.pointerEvents = 'none';
        return;
      }

      const blockRect = dom.getBoundingClientRect();

      cancelHide();
      handleEl.dataset.blockPos = String(blockPos);
      handleEl.style.left = `${blockRect.left - 26}px`;
      handleEl.style.top = `${blockRect.top + 4}px`;
      handleEl.style.opacity = '1';
      handleEl.style.pointerEvents = 'auto';
      activeBlockPos = blockPos;
    }

    function hideHandle() {
      if (handleEl && !isDragging) {
        handleEl.style.opacity = '0';
        handleEl.style.pointerEvents = 'none';
        activeBlockPos = null;
      }
    }

    /* ── Handle event handlers ───────────────── */

    function onHandleMousedown(_e: MouseEvent) {
      if (!currentView || !handleEl) return;
      const blockPos = handleEl.dataset.blockPos;
      if (blockPos == null) return;

      const pos = Number(blockPos);
      const node = currentView.state.doc.nodeAt(pos);
      if (!node) return;

      const selection = NodeSelection.create(currentView.state.doc, pos);
      currentView.dispatch(currentView.state.tr.setSelection(selection));
    }

    function onHandleDragstart(e: DragEvent) {
      if (!currentView || !handleEl) return;
      const blockPos = handleEl.dataset.blockPos;
      if (blockPos == null) return;

      const pos = Number(blockPos);
      const node = currentView.state.doc.nodeAt(pos);
      if (!node) return;

      dragSourcePos = pos;
      isDragging = true;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.textContent ?? '');

        /* Create a compact ghost preview */
        const ghost = document.createElement('div');
        ghost.className = 'studio-drag-ghost';
        const text = node.textContent ?? '';
        ghost.textContent =
          text.slice(0, 48) + (text.length > 48 ? '...' : '');
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        requestAnimationFrame(() => ghost.remove());
      }

      /* Fade the source block */
      const sourceDom = currentView.nodeDOM(pos);
      if (sourceDom instanceof HTMLElement) {
        sourceDom.classList.add('studio-block-dragging');
      }
    }

    function onHandleDragend() {
      /* Fires on the dragged element regardless of drop outcome */
      hideDropIndicator();

      if (currentView && dragSourcePos != null) {
        const sourceDom = currentView.nodeDOM(dragSourcePos);
        if (sourceDom instanceof HTMLElement) {
          sourceDom.classList.remove('studio-block-dragging');
        }
      }

      dragSourcePos = null;
      isDragging = false;

      /* Hide handle after drag ends */
      if (handleEl) {
        handleEl.style.opacity = '0';
      }
    }

    /* ── Scroll tracking ────────────────────── */

    function onScroll() {
      if (activeBlockPos != null && currentView && !isDragging) {
        positionHandle(currentView, activeBlockPos);
      }
    }

    /* ── ProseMirror plugin ─────────────────── */

    return [
      new Plugin({
        key: dragHandlePluginKey,
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              if (isDragging) return false;

              const coords = { left: event.clientX, top: event.clientY };
              const posInfo = view.posAtCoords(coords);
              if (!posInfo) {
                /* Mouse is over padding or margin; keep current handle visible */
                return false;
              }

              const resolved = resolveBlockAt(view, posInfo.pos);
              if (!resolved) {
                return false;
              }

              /* Reposition when changing blocks */
              if (activeBlockPos !== resolved.pos) {
                positionHandle(view, resolved.pos);
              } else {
                cancelHide();
              }

              return false;
            },

            mouseleave(view, event) {
              const related = event.relatedTarget as HTMLElement | null;
              /* Don't hide if moving to the handle itself */
              if (
                related &&
                handleEl &&
                (handleEl === related || handleEl.contains(related))
              ) {
                return false;
              }
              scheduleHide();
              return false;
            },

            dragover(view, event) {
              /* Internal block reorder drag: show indicator */
              if (isDragging && dragSourcePos != null) {
                event.preventDefault();
                if (event.dataTransfer) {
                  event.dataTransfer.dropEffect = 'move';
                }

                const target = nearestDropTarget(view, event.clientY);
                if (target) {
                  showDropIndicator(view, target.pos, target.side);
                }
                return true;
              }

              /* External file drag (images from OS): allow the drop */
              if (event.dataTransfer?.types?.includes('Files')) {
                event.preventDefault();
                if (event.dataTransfer) {
                  event.dataTransfer.dropEffect = 'copy';
                }
                return true;
              }

              return false;
            },

            dragleave(view, event) {
              const related = event.relatedTarget as HTMLElement | null;
              if (!related || !view.dom.contains(related)) {
                hideDropIndicator();
              }
              return false;
            },

            drop(view, event) {
              if (!isDragging || dragSourcePos == null) return false;

              event.preventDefault();
              hideDropIndicator();

              const sourcePos = dragSourcePos;
              const sourceNode = view.state.doc.nodeAt(sourcePos);
              dragSourcePos = null;
              isDragging = false;

              if (!sourceNode) return true;

              const target = nearestDropTarget(view, event.clientY);
              if (!target) return true;

              let insertPos = target.pos;

              /* Don't drop onto itself */
              const sourceEnd = sourcePos + sourceNode.nodeSize;
              if (insertPos >= sourcePos && insertPos <= sourceEnd) {
                const sourceDom = view.nodeDOM(sourcePos);
                if (sourceDom instanceof HTMLElement) {
                  sourceDom.classList.remove('studio-block-dragging');
                }
                return true;
              }

              const { tr } = view.state;

              /*
               * Position adjustment: deleting the source shifts all
               * positions after it. The operation order depends on
               * whether we are dragging up or down.
               */
              if (insertPos > sourcePos) {
                /* Dragging DOWN: delete first, then insert at adjusted pos */
                tr.delete(sourcePos, sourceEnd);
                insertPos -= sourceNode.nodeSize;
              } else {
                /* Dragging UP: insert first, then delete shifted source */
                tr.insert(insertPos, sourceNode);
                tr.delete(
                  sourcePos + sourceNode.nodeSize,
                  sourceEnd + sourceNode.nodeSize,
                );
              }

              view.dispatch(tr);
              return true;
            },
          },
        },
        view(view) {
          currentView = view;

          /* Find the scrollable ancestor for scroll tracking */
          scrollContainer = view.dom.closest(
            '.studio-tiptap-wrapper',
          ) as HTMLElement | null;
          if (scrollContainer) {
            scrollContainer.addEventListener('scroll', onScroll, {
              passive: true,
            });
          }

          return {
            update(updatedView) {
              currentView = updatedView;
              /* Reposition if document structure changed (typing, etc.) */
              if (activeBlockPos != null && !isDragging) {
                const node = updatedView.state.doc.nodeAt(activeBlockPos);
                if (node) {
                  positionHandle(updatedView, activeBlockPos);
                } else {
                  hideHandle();
                }
              }
            },
            destroy() {
              currentView = null;

              if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
              }

              if (scrollContainer) {
                scrollContainer.removeEventListener('scroll', onScroll);
                scrollContainer = null;
              }

              if (handleEl) {
                handleEl.removeEventListener('mousedown', onHandleMousedown);
                handleEl.removeEventListener('dragstart', onHandleDragstart);
                handleEl.removeEventListener('dragend', onHandleDragend);
                handleEl.remove();
                handleEl = null;
              }

              cleanupDropIndicator();
            },
          };
        },
      }),
    ];
  },
});

export default DragHandle;
