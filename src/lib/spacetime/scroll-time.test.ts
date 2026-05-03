import { strict as assert } from 'node:assert';

import {
  spinDirectionFromYears,
  yearFromWheelDelta,
} from './scroll-time';

assert.equal(yearFromWheelDelta(1900, 100, 1800, 2000), 1905);
assert.equal(yearFromWheelDelta(1900, -100, 1800, 2000), 1895);
assert.equal(yearFromWheelDelta(1999, 100, 1800, 2000), 2000);
assert.equal(spinDirectionFromYears(1900, 1905), 1);
assert.equal(spinDirectionFromYears(1905, 1900), -1);
