import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

const dragHandlePluginKey = new PluginKey('dragHandle');

/* ── Position helpers ────────────────────────── */

/** Find the top-level block node at a given document position. */
function resolveBlockAt(view: EditorView, pos: number): { node: ProseMirrorNode; pos: number } | null {
  const $pos = view.state.doc.resolve(pos);
  const depth = $pos.depth;
  if (depth < 1) return null;
  const nodePos = $pos.before(1);
  const node = view.state.doc.nodeAt(nodePos);
  if (!node) return null;
  return { node, pos: nodePos };
}

/** Find the nearest block boundary (top-level) for a drop target. */
function nearestDropTarget(
  view: EditorView,
  y: number,
): { pos: number; side: 'before' | 'after' } | null {
  const { doc } = view.state;
  let best: { pos: number; side: 'before' | 'after'; dist: number } | null = null;

  doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    /* Check distance to top edge (insert before) */
    const distBefore = Math.abs(y - rect.top);
    if (!best || distBefore < best.dist) {
      best = { pos: offset, side: 'before', dist: distBefore };
    }

    /* Check distance to bottom edge (insert after) */
    const distAfter = Math.abs(y - rect.bottom);
    if (distAfter < best.dist) {
      best = { pos: offset + node.nodeSize, side: 'after', dist: distAfter };
    }
  });

  return best;
}

/* ── Drop indicator DOM ──────────────────────── */

let dropIndicator: HTMLElement | null = null;

function showDropIndicator(view: EditorView, targetPos: number, side: 'before' | 'after') {
  const { doc } = view.state;

  /* Find the DOM node at target position to get coordinates */
  let refDom: HTMLElement | null = null;

  if (side === 'before') {
    refDom = view.nodeDOM(targetPos) as HTMLElement | null;
  } else {
    /* For 'after', targetPos points after the node, walk back */
    const $pos = doc.resolve(targetPos);
    const beforePos = $pos.before($pos.depth);
    refDom = view.nodeDOM(beforePos) as HTMLElement | null;
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

/* ── Extension ───────────────────────────────── */

const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let dragSourcePos: number | null = null;
    let isDragging = false;

    return [
      new Plugin({
        key: dragHandlePluginKey,
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.forEach((node, pos) => {
              if (node.isBlock) {
                const handle = document.createElement('div');
                handle.className = 'studio-drag-handle';
                handle.contentEditable = 'false';
                handle.draggable = true;
                handle.textContent = '\u2630';
                handle.dataset.blockPos = String(pos);

                decorations.push(
                  Decoration.widget(pos, handle, {
                    side: -1,
                    key: `drag-${pos}`,
                  }),
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement;
              if (!target.classList.contains('studio-drag-handle')) return false;

              /* Select the block on mousedown (existing behavior) */
              const blockPos = target.dataset.blockPos;
              if (blockPos == null) return false;

              const pos = Number(blockPos);
              const node = view.state.doc.nodeAt(pos);
              if (!node) return false;

              const selection = NodeSelection.create(view.state.doc, pos);
              view.dispatch(view.state.tr.setSelection(selection));

              return false;
            },

            dragstart(view, event) {
              const target = event.target as HTMLElement;
              if (!target.classList.contains('studio-drag-handle')) return false;

              const blockPos = target.dataset.blockPos;
              if (blockPos == null) return false;

              const pos = Number(blockPos);
              const node = view.state.doc.nodeAt(pos);
              if (!node) return false;

              dragSourcePos = pos;
              isDragging = true;

              /* Set drag data so the browser shows a ghost */
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', node.textContent ?? '');

                /* Create a lightweight ghost element */
                const ghost = document.createElement('div');
                ghost.className = 'studio-drag-ghost';
                ghost.textContent = (node.textContent ?? '').slice(0, 48) + (node.textContent && node.textContent.length > 48 ? '...' : '');
                ghost.style.position = 'absolute';
                ghost.style.top = '-1000px';
                document.body.appendChild(ghost);
                event.dataTransfer.setDragImage(ghost, 0, 0);
                requestAnimationFrame(() => ghost.remove());
              }

              /* Add dragging class to source block */
              const sourceDom = view.nodeDOM(pos);
              if (sourceDom instanceof HTMLElement) {
                sourceDom.classList.add('studio-block-dragging');
              }

              return false;
            },

            dragover(view, event) {
              if (!isDragging || dragSourcePos == null) return false;

              event.preventDefault();
              if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
              }

              const target = nearestDropTarget(view, event.clientY);
              if (target) {
                showDropIndicator(view, target.pos, target.side);
              }

              return true;
            },

            dragleave(view, event) {
              /* Only hide if we're leaving the editor entirely */
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
                /* Remove dragging class */
                const sourceDom = view.nodeDOM(sourcePos);
                if (sourceDom instanceof HTMLElement) {
                  sourceDom.classList.remove('studio-block-dragging');
                }
                return true;
              }

              const { tr } = view.state;

              /* If dropping after the source, we need to adjust for
                 the upcoming deletion shifting positions */
              if (insertPos > sourcePos) {
                /* Delete first, then adjust insert position */
                tr.delete(sourcePos, sourceEnd);
                insertPos -= sourceNode.nodeSize;
              } else {
                /* Insert first at earlier position, then delete shifted source */
                tr.insert(insertPos, sourceNode);
                tr.delete(
                  sourcePos + sourceNode.nodeSize,
                  sourceEnd + sourceNode.nodeSize,
                );
              }

              view.dispatch(tr);
              return true;
            },

            dragend(view) {
              /* Clean up regardless of whether drop succeeded */
              hideDropIndicator();

              if (dragSourcePos != null) {
                const sourceDom = view.nodeDOM(dragSourcePos);
                if (sourceDom instanceof HTMLElement) {
                  sourceDom.classList.remove('studio-block-dragging');
                }
              }

              dragSourcePos = null;
              isDragging = false;
              return false;
            },
          },
        },
        view() {
          return {
            destroy() {
              cleanupDropIndicator();
            },
          };
        },
      }),
    ];
  },
});

export default DragHandle;
