import assert from 'node:assert/strict';
import { rename } from './label.mjs';
const before = { id: 'label-1', name: 'Inbox' };
assert.equal(rename(before, '  '), before);
assert.deepEqual(rename(before, ' Work '), { id: 'label-1', name: 'Work' });
assert.equal(before.name, 'Inbox');
