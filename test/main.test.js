import { test } from 'node:test';
import assert from 'node:assert/strict';

// Exercise the app's event handlers using native EventTarget and deferred fetches.
test('loading uses valid URL state and the most recently selected source', async (t) => {
  class Element extends EventTarget {
    value = '';
    checked = true;
    textContent = '';
    innerHTML = '';
    files = [];
  }
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  getElementById('groupSelect').value = 'default';
  const window = new EventTarget();
  window.location = {
    href: 'http://192.168.4.36:5174/?group=constructor#section-1',
    search: '?group=constructor', pathname: '/', hash: '#section-1'
  };
  let stateUrl;
  window.history = { replaceState: (_, __, url) => { stateUrl = url; } };
  const requests = [];
  const original = new Map(['window', 'document', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  globalThis.window = window;
  globalThis.document = { getElementById };
  globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const response = title => ({ ok: true, text: async () => `@article{a,title={${title}}}` });
  const submit = url => {
    getElementById('urlInput').value = url;
    getElementById('sourceForm').dispatchEvent(new Event('submit', { cancelable: true }));
  };
  await import('../src/main.js');
  assert.equal(requests[0].url, 'http://192.168.4.36:5174/bib/roars.bib');
  assert.equal(getElementById('groupSelect').value, 'default');
  assert.ok(stateUrl.endsWith('#section-1'));

  submit('http://localhost:8000/test.bib');
  assert.equal(requests[1].url, 'http://localhost:8000/test.bib');
  assert.equal(requests[0].options.signal.aborted, true);
  requests[1].resolve(response('New source'));
  await flush();
  requests[0].resolve(response('Stale source'));
  await flush();
  assert.match(getElementById('publications-container').innerHTML, /New source/);
  assert.doesNotMatch(getElementById('publications-container').innerHTML, /Stale source/);

  submit('https://github.com/owner/repo/blob/main/papers.bib');
  assert.equal(requests[2].url, 'https://raw.githubusercontent.com/owner/repo/main/papers.bib');
  const fileInput = getElementById('fileInput');
  fileInput.files = [{ name: 'local.bib', text: async () => '@article{b,title={Uploaded source}}' }];
  fileInput.dispatchEvent(new Event('change'));
  await flush();
  requests[2].resolve(response('Old network source'));
  await flush();
  assert.match(getElementById('publications-container').innerHTML, /Uploaded source/);

  submit('javascript:alert(1)');
  assert.equal(requests.length, 3);
  assert.match(getElementById('publications-container').innerHTML, /HTTP or HTTPS/);
});
