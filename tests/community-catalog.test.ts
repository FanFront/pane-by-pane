import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMMUNITY_GROUPS, COMMUNITY_PICKS, workshopUrl } from '../src/web/communityCatalog.ts';

test('twenty verified and attributed Glimmith Workshop discoveries', () => {
  assert.equal(COMMUNITY_PICKS.length, 20);
  assert.equal(new Set(COMMUNITY_PICKS.map((p) => p.id)).size, 20);
  assert.equal(COMMUNITY_GROUPS.length, 3);
  const categories = new Set(COMMUNITY_GROUPS.map((g) => g.id));
  for (const pick of COMMUNITY_PICKS) {
    assert.match(pick.id, /^\d{8,20}$/);
    assert.ok(pick.title.trim() && pick.creator.trim() && pick.description.trim());
    assert.ok(categories.has(pick.category));
    assert.equal(workshopUrl(pick), 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + pick.id);
    // Steam Workshop item metadata must never masquerade as a playable level.
    assert.ok(!('puzzle' in pick) && !('solution' in pick));
  }
  assert.deepEqual(COMMUNITY_GROUPS.map((g) => COMMUNITY_PICKS.filter((p) => p.category === g.id).length), [7, 4, 9]);
  assert.throws(() => workshopUrl({...COMMUNITY_PICKS[0], id:'javascript:alert(1)'}), /Invalid/);
});

test('level selection exposes separate Workshop discovery without breaking native imports', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
  const main = readFileSync(new URL('../src/web/main.ts', import.meta.url), 'utf-8');
  for (const id of ['levels-view-builtins', 'levels-view-community', 'level-bundled-panel',
    'community-panel', 'community-filter', 'community-file', 'community-results']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing accessible element ' + id);
  }
  assert.match(main, /importLocalPack\(communityFile\)/);
  assert.match(main, /renderCommunityBrowser\(\)/);
  assert.match(main, /savePersonalPack\(pack\)/);
});
