import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPublication, renderPublications, updateStats, escapeHtml, sanitizeLatexHtml } from '../src/renderer.js';
import { groupByYear } from '../src/parser.js';

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

test('link label depends on the URL; tools only link from the title', () => {
  const pdf = renderPublication({ ...pub, url: 'https://x.org/a.pdf' });
  assert.match(pdf, /href="https:\/\/x\.org\/a\.pdf">PDF/);
  const arxiv = renderPublication({ ...pub, url: 'https://arxiv.org/pdf/2307.10266' });
  assert.match(arxiv, /href="https:\/\/arxiv\.org\/pdf\/2307.10266">PDF/);
  const page = renderPublication({ ...pub, url: 'https://x.org/page' });
  assert.match(page, />Link<\/a>/);
  const tool = renderPublication({ ...pub, type: 'tool', url: 'https://x.org/page' });
  assert.ok(!tool.includes('>Link</a>'));
  assert.match(tool, /\[Tool\]/);
});

test('tools show neither a year nor "to appear"', () => {
  const year = new Date().getFullYear();
  assert.match(renderPublication({ ...pub, year }), /to appear/);
  const html = renderPublication({ ...pub, type: 'tool', year }, true);
  assert.ok(!html.includes('to appear'));
  assert.ok(!html.includes(`(${year})`));
});

test('untrusted publication links cannot execute scripts', () => {
  for (const url of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)']) {
    const html = renderPublication({ ...pub, url });
    assert.ok(!html.includes('href="' + url), url);
    assert.ok(!html.includes('>Link</a>'), url);
    assert.match(html, /&lt;b&gt;Title&lt;\/b&gt;/);
  }
});

test('presentation PDFs are labeled separately from papers', () => {
  const html = renderPublication({ ...pub, slidesUrl: 'https://example.org/slides.pdf' });
  assert.match(html, /href="https:\/\/example\.org\/slides\.pdf">Slides<\/a>/);
  const unsafe = renderPublication({ ...pub, slidesUrl: 'javascript:alert(1)' });
  assert.ok(!unsafe.includes('href="javascript:'));
});

test('news is visible but excluded from publication headings, totals, and summary statistics', (t) => {
  const previousDocument = globalThis.document;
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  const nav = { innerHTML: '' };
  const stats = { textContent: '' };
  globalThis.document = { getElementById: id => id === 'section-nav' ? nav : stats };
  const paper = { ...pub, year: 2025, venue: 'Conference' };
  const news = { ...pub, key: 'news', type: 'news', title: 'Lab news', year: 2024, venue: 'News outlet' };
  const entries = [paper, news];
  const container = { innerHTML: '' };
  renderPublications(groupByYear(entries), container);
  assert.match(container.innerHTML, /2025 \(1\)/);
  assert.doesNotMatch(nav.innerHTML, /2024/);
  assert.match(container.innerHTML, /Lab news/);
  assert.match(container.innerHTML, /News \(1\)/);
  updateStats(entries, entries);
  assert.equal(stats.textContent, '1 publication · 1 year · 1 venue');
  updateStats([news], entries);
  assert.equal(stats.textContent, 'Showing 0 of 1 publication');
  updateStats([news], [news]);
  assert.equal(stats.textContent, '');
});
