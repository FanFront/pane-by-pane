import test from 'node:test';
import assert from 'node:assert/strict';
import { isBoardViewportControl, preventBoardTouchDefault } from '../src/web/boardTouch.ts';

/**
 * Model a descendant (icon/span/text) inside the corresponding control. The
 * real browser Element.closest() walks the ancestor chain in the same way.
 */
function targetWithAncestors(...ancestors: string[]): EventTarget {
  return {
    closest(selector: string) {
      const eligible = selector.split(',').map((part) => part.trim());
      return ancestors.find((tag) => eligible.includes(tag)) ? {} : null;
    },
  } as unknown as EventTarget;
}

function canceled(target: EventTarget | null): boolean {
  let prevented = false;
  preventBoardTouchDefault({
    target,
    preventDefault: () => { prevented = true; },
  });
  return prevented;
}

test('tap gestures on board rotate and zoom reset buttons are not canceled', () => {
  for (const target of [
    targetWithAncestors('span', 'button'),   // rotation angle label / reset symbol
    targetWithAncestors('svg', 'button'),    // icon
    targetWithAncestors('button'),
    targetWithAncestors('[role="button"]'),
  ]) {
    assert.equal(isBoardViewportControl(target), true);
    assert.equal(canceled(target), false, 'touchstart/end must reach the native click synthesis');
  }
});

test('board touches are still canceled to prevent scrolling and browser zoom', () => {
  for (const target of [
    targetWithAncestors('canvas', 'div'),
    targetWithAncestors('div'),
    null,
  ]) {
    assert.equal(isBoardViewportControl(target), false);
    assert.equal(canceled(target), true);
  }
});

test('future buttons and interactive elements in the board viewport remain usable', () => {
  for (const tag of ['a', 'input', 'select', 'textarea']) {
    const target = targetWithAncestors('span', tag);
    assert.equal(canceled(target), false);
  }
});
