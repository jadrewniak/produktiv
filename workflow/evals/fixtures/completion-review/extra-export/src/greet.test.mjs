import assert from 'node:assert/strict';
import test from 'node:test';
import { farewell, greet } from './greet.mjs';

test('greet names the person', () => {
  assert.equal(greet('Ada'), 'Hello, Ada');
});

test('farewell names the person', () => {
  assert.equal(farewell('Ada'), 'Goodbye, Ada');
});
