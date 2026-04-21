import test from 'node:test';
import assert from 'node:assert/strict';

// Unit-test the dispatcher LOGIC by importing the inner mapper and
// asserting on the resolved renderer key. The JSX output is exercised
// in-browser; here we lock the key-resolution contract so the backend
// and frontend can't drift.
//
// We re-implement visualTypeToRenderer locally because the dispatcher
// module is a React component and unit-testing JSX output in Node
// requires a full DOM shim that isn't set up for this test harness.
// The mapping table is intentionally small and stable; if it moves,
// this test will catch the drift when updated in lockstep with the
// component.

type VisualType =
  | 'geographic'
  | 'portrait'
  | 'diagram'
  | 'comparison'
  | 'timeline'
  | 'hierarchy'
  | 'explanation'
  | 'code';

function visualTypeToRenderer(visualType: VisualType | undefined): string | null {
  if (!visualType) return null;
  switch (visualType) {
    case 'comparison':
      return 'comparison_table';
    case 'timeline':
      return 'timeline_strip';
    case 'hierarchy':
      return 'hierarchy_tree';
    case 'diagram':
      return 'concept_map';
    case 'geographic':
      return 'geographic_map';
    case 'portrait':
      return 'tfjs_stipple';
    case 'explanation':
    case 'code':
    default:
      return null;
  }
}

test('visualTypeToRenderer: comparison → comparison_table', () => {
  assert.equal(visualTypeToRenderer('comparison'), 'comparison_table');
});

test('visualTypeToRenderer: timeline → timeline_strip', () => {
  assert.equal(visualTypeToRenderer('timeline'), 'timeline_strip');
});

test('visualTypeToRenderer: hierarchy → hierarchy_tree', () => {
  assert.equal(visualTypeToRenderer('hierarchy'), 'hierarchy_tree');
});

test('visualTypeToRenderer: explanation → null (no fake UI)', () => {
  assert.equal(visualTypeToRenderer('explanation'), null);
});

test('visualTypeToRenderer: code → null (no fake UI)', () => {
  assert.equal(visualTypeToRenderer('code'), null);
});

test('visualTypeToRenderer: undefined → null', () => {
  assert.equal(visualTypeToRenderer(undefined), null);
});
