// H2 (SYSTEMS-DESIGN.md section 4): saved cameras. Ctrl+F5-F8 saves the view, F5-F8 recalls it; sandbox cheats move to
// Shift+F5-F8. The routing is a pure function (cameraKeyAction) so each key is pinned here, not only in the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraRig, createCameraMarks, cameraKeyAction } from '../play/camera.mjs';

test('Ctrl+F5-F8 saves a camera, F5-F8 recalls it', () => {
  for (const key of ['F5', 'F6', 'F7', 'F8']) {
    assert.equal(cameraKeyAction(key, { ctrl: true }), 'save', `${key} with Ctrl saves`);
    assert.equal(cameraKeyAction(key, { meta: true }), 'save', `${key} with Cmd saves`);
    assert.equal(cameraKeyAction(key, {}), 'recall', `${key} recalls`);
    assert.equal(cameraKeyAction(key, { sandbox: true }), 'recall', `${key} in a sandbox still recalls`);
  }
});

test('Shift+F5-F8 is the sandbox cheat, and does nothing but recall outside a sandbox', () => {
  for (const key of ['F5', 'F6', 'F7', 'F8']) {
    assert.equal(cameraKeyAction(key, { shift: true, sandbox: true }), 'cheat', `Shift+${key} cheats in a sandbox`);
    assert.equal(cameraKeyAction(key, { shift: true, sandbox: false }), 'recall', `Shift+${key} recalls outside a sandbox`);
  }
});

test('Ctrl wins over Shift, and keys outside F5-F8 are not camera keys', () => {
  assert.equal(cameraKeyAction('F5', { ctrl: true, shift: true, sandbox: true }), 'save');
  assert.equal(cameraKeyAction('F4', {}), null);
  assert.equal(cameraKeyAction('F9', { ctrl: true }), null);
  assert.equal(cameraKeyAction('a', {}), null);
});

test('a saved camera returns the same centre and zoom after the rig has moved', () => {
  const rig = createCameraRig(64, 64, { x: 30, y: 30 });
  rig.zoom = 20;
  const marks = createCameraMarks();
  marks.save('F6', rig);
  rig.centerOn(5, 5);
  rig.zoomBy(0.5);
  assert.equal(marks.recall('F6', rig), true);
  assert.equal(rig.x, 30);
  assert.equal(rig.y, 30);
  assert.equal(rig.zoom, 20);
});

test('each slot keeps its own camera, and recalling an empty slot changes nothing', () => {
  const rig = createCameraRig(64, 64, { x: 30, y: 30 });
  const marks = createCameraMarks();
  assert.equal(marks.recall('F5', rig), false);
  assert.equal(rig.x, 30);
  marks.save('F5', rig);
  rig.centerOn(10, 12);
  marks.save('F7', rig);
  marks.recall('F5', rig);
  assert.equal(rig.x, 30);
  marks.recall('F7', rig);
  assert.equal(rig.x, 10);
  assert.equal(rig.y, 12);
});
