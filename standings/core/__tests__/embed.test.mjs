import assert from 'node:assert/strict';
import { EMBED_ROW_CAP, capEmbedRows, embedCapLinkHTML, isEmbedSearch } from '../embed.js';

assert.equal(isEmbedSearch('?tab=drivers&embed=1'), true);
assert.equal(isEmbedSearch('?tab=drivers&embed=0'), false);
assert.equal(isEmbedSearch(''), false);
assert.equal(EMBED_ROW_CAP, 10);

// Outside a browser window the module is not in embed mode: nothing is capped and no link is emitted.
const rows = Array.from({ length: 22 }, (_, i) => i);
assert.equal(capEmbedRows(rows).length, 22);
assert.equal(capEmbedRows(null).length, 0);
assert.equal(embedCapLinkHTML(22), '');
