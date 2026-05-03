import { strict as assert } from 'node:assert';

import { comparePeriods } from './compare-periods';

const comparison = comparePeriods(
  [
    { id: 'a', label: 'Paris', year: 1850 },
    { id: 'b', label: 'Paris', year: 1950 },
    { id: 'c', label: 'Detroit', year: 1955 },
  ],
  { startYear: 1800, endYear: 1899 },
  { startYear: 1900, endYear: 1999 },
);

assert.deepEqual(comparison.sharedLabels, ['Paris']);
assert.equal(comparison.onlySecond.length, 1);

const disjoint = comparePeriods(
  [
    { id: 'a', label: 'Paris', year: 1850 },
    { id: 'b', label: 'Detroit', year: 1950 },
  ],
  { startYear: 1800, endYear: 1899 },
  { startYear: 1900, endYear: 1999 },
);

assert.deepEqual(disjoint.sharedLabels, []);
assert.equal(disjoint.onlyFirst.length, 1);
