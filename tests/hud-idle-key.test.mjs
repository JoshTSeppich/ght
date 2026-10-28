// Card 8 item 6: the idle-Crumb button shows its key (F1) on its face, not only in the tooltip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { idleButtonHtml } from '../play/idle-crumbs.mjs';

test('the idle-Crumb button shows F1 on its face', () => {
  assert.match(idleButtonHtml(2), /Idle Crumbs <b>2<\/b> <kbd>F1<\/kbd>/);
});

test('no idle Crumbs, no button', () => {
  assert.equal(idleButtonHtml(0), '');
});
