import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { readLibrary, saveSongs, removeSong } from '../src/storage.ts';

test('local storage persists original bytes, metadata and section edits atomically', async () => {
  const initial = await readLibrary(); assert.equal(initial.seeded, false);
  const song = { id: 'local-test', title: 'Test', source: new Uint8Array([0, 255, 128]), sections: [{ id: 's1', name: 'Intro', start: 1, end: 4 }] };
  await saveSongs([song], true);
  let data = await readLibrary(); assert.equal(data.seeded, true); assert.equal(data.songs.length, 1);
  assert.deepEqual(data.songs[0].source, song.source);
  await saveSongs([{ ...song, sections: [{ ...song.sections[0], name: 'Opening', color: '#abcdef' }] }]);
  data = await readLibrary(); assert.equal(data.songs[0].sections[0].name, 'Opening');
  await removeSong(song.id);
  data = await readLibrary(); assert.equal(data.songs.length, 0); assert.equal(data.seeded, true);
});
