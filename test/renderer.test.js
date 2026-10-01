import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPublication, escapeHtml, sanitizeLatexHtml } from '../src/renderer.js';

const pub = {
  key: 'k1', type: 'journal', title: 'A <b>Title</b>', authors: 'Jane Doe<sup>3</sup>, John Roe<sup>1</sup>',
  year: 2020, venue: '', pages: '', doi: null, eprint: null, url: null,
  awards: [], keywords: ['formal-methods'], publisher: null, volume: null, number: null, raw: '@article{k1}'
};

test('escapeHtml and sanitizeLatexHtml', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(sanitizeLatexHtml('x<sup>2</sup> <script>'), 'x<sup>2</sup> &lt;script&gt;');
});

test('author level markers get tooltips', () => {
  const html = renderPublication(pub);
  assert.match(html, /<sup title="PhD student">3<\/sup>/);
  assert.match(html, /<sup title="Undergraduate student">1<\/sup>/);
});

test('empty fields do not produce blank lines', () => {
  const html = renderPublication(pub);
  assert.ok(!html.includes('<br><br>'));
  assert.ok(!/<br>\s*<br>/.test(html));
});

test('title is escaped and links are built from available fields', () => {
  const html = renderPublication({ ...pub, doi: '10.1/x', eprint: '2001.0001' });
  assert.match(html, /&lt;b&gt;Title&lt;\/b&gt;/);
  assert.match(html, /href="https:\/\/doi\.org\/10\.1\/x">DOI/);
  assert.match(html, /href="https:\/\/arxiv\.org\/abs\/2001\.0001">arXiv/);
  assert.match(html, /data-bibtex="k1">BibTeX/);
});
