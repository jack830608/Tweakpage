import { beforeEach, describe, expect, test } from 'vitest';
import { applyAll, ensureStyleTag, revertAll } from './apply';
import type { EditRecord } from './types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1',
    selector: '.title',
    fallbackSelectors: [],
    elementLabel: 'h1.title',
    type: 'style',
    property: 'color',
    oldValue: 'rgb(0, 0, 0)',
    newValue: '#ff0000',
    enabled: true,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 class="title">Original</h1><img class="hero" src="/a.png">';
});

test('applyAll writes style rules into a single data-tweakpage-style tag', () => {
  applyAll([record({})], document);
  const tags = document.querySelectorAll('style[data-tweakpage-style]');
  expect(tags).toHaveLength(1);
  expect(tags[0].textContent).toBe('[data-tweakpage~="r1"] { color: #ff0000 !important; }');
});

test('applyAll is idempotent: second run keeps one tag and identical css', () => {
  applyAll([record({})], document);
  const tag = document.querySelector('style[data-tweakpage-style]')!;
  applyAll([record({})], document);
  expect(document.querySelectorAll('style[data-tweakpage-style]')).toHaveLength(1);
  expect(document.querySelector('style[data-tweakpage-style]')).toBe(tag);
});

test('applyAll applies text edits idempotently', () => {
  const r = record({ id: 'r2', type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed' });
  applyAll([r], document);
  const h1 = document.querySelector('.title')!;
  expect(h1.textContent).toBe('Changed');
  const statuses = applyAll([r], document);
  expect(h1.textContent).toBe('Changed');
  expect(statuses.get('r2')).toBe('applied');
});

test('applyAll applies attr edits', () => {
  const r = record({ id: 'r3', selector: '.hero', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' });
  applyAll([r], document);
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/b.png');
});

test('applyAll reports not-found and disabled statuses', () => {
  const statuses = applyAll(
    [record({ id: 'r4', selector: '.missing' }), record({ id: 'r5', enabled: false })],
    document,
  );
  expect(statuses.get('r4')).toBe('not-found');
  expect(statuses.get('r5')).toBe('disabled');
});

test('revertAll removes the style tag and restores text and attrs', () => {
  const text = record({ id: 'r2', type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed' });
  const attr = record({ id: 'r3', selector: '.hero', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' });
  applyAll([record({}), text, attr], document);
  revertAll([record({}), text, attr], document);
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
  expect(document.querySelector('.title')!.textContent).toBe('Original');
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/a.png');
});

test('ensureStyleTag reuses an existing tag', () => {
  const a = ensureStyleTag(document);
  const b = ensureStyleTag(document);
  expect(a).toBe(b);
});

test('applyAll removes the style tag when no enabled style records remain', () => {
  applyAll([record({})], document);
  expect(document.querySelector('style[data-tweakpage-style]')).not.toBeNull();
  applyAll([record({ enabled: false })], document);
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
  applyAll([], document);
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
});

test('a selector that now matches several elements styles none of them', () => {
  document.body.innerHTML = '<button class="btn">One</button><button class="btn">Two</button>';
  const statuses = applyAll([record({ selector: '.btn', type: 'style', property: 'color' })], document);

  // The rule used to be emitted as `.btn { ... }`, which restyled both buttons while the
  // review list reported the edit as not applied.
  expect(statuses.get('r1')).toBe('not-found');
  expect(document.querySelector('style[data-tweakpage-style]')).toBeNull();
  expect(document.querySelectorAll('[data-tweakpage]')).toHaveLength(0);
});

test('the mark lands only on the element the record resolved to', () => {
  document.body.innerHTML = '<h1 class="title">One</h1><h1 class="other">Two</h1>';
  applyAll([record({ selector: '.title', type: 'style', property: 'color' })], document);
  expect(document.querySelector('.title')!.getAttribute('data-tweakpage')).toBe('r1');
  expect(document.querySelector('.other')!.hasAttribute('data-tweakpage')).toBe(false);
});

test('marks are dropped when their record goes away', () => {
  applyAll([record({ type: 'style', property: 'color' })], document);
  expect(document.querySelectorAll('[data-tweakpage]')).toHaveLength(1);
  applyAll([], document);
  expect(document.querySelectorAll('[data-tweakpage]')).toHaveLength(0);
});

test('two style edits on one element share a single mark', () => {
  applyAll(
    [
      record({ id: 'r1', type: 'style', property: 'color' }),
      record({ id: 'r2', type: 'style', property: 'fontSize', newValue: '40px' }),
    ],
    document,
  );
  expect(document.querySelector('.title')!.getAttribute('data-tweakpage')).toBe('r1 r2');
});

describe('moves and the records around them', () => {
  const base = {
    fallbackSelectors: [] as string[], enabled: true, createdAt: 'n', updatedAt: 'n',
  };

  test('a move earlier in the list cannot poison a positional selector later in it', () => {
    // Everything resolves against the page as loaded, then mutations run — otherwise
    // the move shifts nth positions under the feet of the records after it. Images on
    // purpose: no text means no fingerprint rescue, only ordering saves this.
    document.body.innerHTML = '<div><img id="a"><img id="b"><img id="c"></div>';
    const statuses = applyAll(
      [
        { ...base, id: 'mv1', selector: 'img:nth-of-type(1)', elementLabel: 'img',
          type: 'move', property: 'domIndex', oldValue: '0', newValue: '2' },
        { ...base, id: 'st1', selector: 'img:nth-of-type(3)', elementLabel: 'img',
          type: 'style', property: 'opacity', oldValue: '1', newValue: '0.5' },
      ],
      document,
    );
    expect([...document.querySelectorAll('img')].map((el) => el.id)).toEqual(['b', 'c', 'a']);
    expect(
      document.getElementById('c')!.getAttribute('data-tweakpage'),
      'the style mark belongs to the img that was third on load',
    ).toContain('st1');
    expect([...statuses.values()]).toEqual(['applied', 'applied']);
  });

  test('reapply follows the mark, not the selector the move made stale', () => {
    // After the move, p:nth-of-type(2) names a different element. The first apply
    // stamped the real one; every later apply has to keep moving that node.
    document.body.innerHTML = '<div><img id="a"><img id="b"><img id="c"></div>';
    const records: Parameters<typeof applyAll>[0] = [
      { ...base, id: 'mv2', selector: 'img:nth-of-type(2)', elementLabel: 'img',
        type: 'move', property: 'domIndex', oldValue: '1', newValue: '0' },
    ];
    applyAll(records, document);
    const order = () => [...document.querySelectorAll('img')].map((el) => el.id).join('');
    expect(order()).toBe('bac');

    // No text to fingerprint on an image — only the mark can identify it now.
    applyAll(records, document);
    expect(order(), 'a second pass must not move whoever sits at position 2').toBe('bac');
  });

  test('revertAll finds a moved element while its mark still exists', () => {
    // revertAll strips marks — but a moved image is only findable BY its mark, so the
    // stripping has to come after the moves are undone, not before.
    document.body.innerHTML = '<div><img id="a"><img id="b"><img id="c"></div>';
    const records: Parameters<typeof applyAll>[0] = [
      { ...base, id: 'mv3', selector: 'img:nth-of-type(1)', elementLabel: 'img',
        type: 'move', property: 'domIndex', oldValue: '0', newValue: '2' },
    ];
    applyAll(records, document);
    expect([...document.querySelectorAll('img')].map((el) => el.id)).toEqual(['b', 'c', 'a']);

    revertAll(records, document);
    expect([...document.querySelectorAll('img')].map((el) => el.id)).toEqual(['a', 'b', 'c']);
  });

  test('reverting several moves in one parent restores the exact original order', () => {
    document.body.innerHTML = '<div><p id="a">A</p><p id="b">B</p><p id="c">C</p><p id="d">D</p></div>';
    const records: Parameters<typeof applyAll>[0] = [
      { ...base, id: 'mvd', selector: '#d', elementLabel: 'p', type: 'move', property: 'domIndex', oldValue: '3', newValue: '0' },
      { ...base, id: 'mva', selector: '#a', elementLabel: 'p', type: 'move', property: 'domIndex', oldValue: '0', newValue: '2' },
    ];
    applyAll(records, document);
    const order = () => [...document.querySelectorAll('p')].map((el) => el.id).join('');
    expect(order()).toBe('dbac');

    revertAll(records, document);
    expect(order()).toBe('abcd');
  });
});

describe('clone records through applyAll', () => {
  const base = { fallbackSelectors: [] as string[], enabled: true, createdAt: 'n', updatedAt: 'n' };

  test('a clone shifting nth positions cannot steal a sibling record on reapply', () => {
    // Images on purpose: no fingerprint rescue. Pass 1 resolves against the pristine
    // page; the clone then makes img:nth-of-type(2) mean a different element. From the
    // first apply on, the mark is every record's identity, so pass 2 follows it.
    document.body.innerHTML = '<div><img id="a"><img id="b"></div>';
    const records: Parameters<typeof applyAll>[0] = [
      { ...base, id: 'cl9', selector: 'img:nth-of-type(1)', elementLabel: 'img',
        type: 'clone', property: 'clone', oldValue: '', newValue: '' },
      { ...base, id: 'at9', selector: 'img:nth-of-type(2)', elementLabel: 'img',
        type: 'attr', property: 'alt', oldValue: '', newValue: 'edited alt', absent: true },
    ];
    applyAll(records, document);
    expect(document.getElementById('b')!.getAttribute('alt'), 'pass 1: pristine resolution').toBe('edited alt');
    expect(document.querySelectorAll('img'), 'the copy exists').toHaveLength(3);

    // Pass 2 — what the mutation observer triggers right after the insertion.
    applyAll(records, document);
    const clone = document.querySelector('[data-tweakpage-clone="cl9"]')!;
    expect(clone.getAttribute('alt'), 'the clone (now nth 2) must not inherit the edit').toBeNull();
    expect(document.getElementById('b')!.getAttribute('alt')).toBe('edited alt');
  });

  test('a record can target the copy itself once it exists', () => {
    document.body.innerHTML = '<div><p id="src">Original</p></div>';
    const records: Parameters<typeof applyAll>[0] = [
      { ...base, id: 'cl10', selector: '#src', elementLabel: 'p',
        type: 'clone', property: 'clone', oldValue: '', newValue: '' },
      { ...base, id: 'tx10', selector: '[data-tweakpage-clone="cl10"]', elementLabel: 'p',
        type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'The copy, edited' },
    ];
    // Fresh load: the copy does not exist when the text record first resolves. The
    // share preview has no reapply loop, so applyAll itself gives the one extra
    // resolution round the insertion makes meaningful.
    const first = applyAll(records, document);
    expect(first.get('tx10'), 'one call converges — previews have no second chance').toBe('applied');
    expect(document.querySelector('[data-tweakpage-clone="cl10"]')!.textContent).toBe('The copy, edited');
    expect(document.getElementById('src')!.textContent, 'the original is untouched').toBe('Original');
  });

  test('revertAll takes the copy away with everything else', () => {
    document.body.innerHTML = '<div><p id="src">Original</p></div>';
    const records: Parameters<typeof applyAll>[0] = [
      { ...base, id: 'cl11', selector: '#src', elementLabel: 'p',
        type: 'clone', property: 'clone', oldValue: '', newValue: '' },
    ];
    applyAll(records, document);
    expect(document.querySelectorAll('p')).toHaveLength(2);
    revertAll(records, document);
    expect(document.querySelectorAll('p')).toHaveLength(1);
  });
});

test("a style edit inside a copy lands on the copy in one pass — the sender's exact share", () => {
  // The reported repro: duplicate a section, restyle something inside the copy, share.
  // The recipient's preview applies through the controller, which never reapplies.
  document.body.innerHTML =
    '<section class="block"><div class="inner"><p>Text</p></div></section>';
  const base = { fallbackSelectors: [] as string[], enabled: true, createdAt: 'n', updatedAt: 'n' };
  const records: Parameters<typeof applyAll>[0] = [
    { ...base, id: 'cl20', selector: '.block', elementLabel: 'section',
      type: 'clone', property: 'clone', oldValue: '', newValue: '' },
    { ...base, id: 'st20', selector: '[data-tweakpage-clone="cl20"] > div:nth-child(1)', elementLabel: 'div',
      type: 'style', property: 'backgroundColor', oldValue: '', newValue: '#434195' },
  ];
  const statuses = applyAll(records, document);
  expect(statuses.get('st20')).toBe('applied');

  const copyInner = document.querySelector('[data-tweakpage-clone="cl20"] > .inner')!;
  expect(copyInner.getAttribute('data-tweakpage'), 'styled: the copy').toContain('st20');
  const originalInner = document.querySelectorAll('.inner')[0];
  expect(originalInner.getAttribute('data-tweakpage') ?? '', 'unstyled: the original').not.toContain('st20');
});

test('a fingerprint must not smuggle a copy-scoped record onto the original', () => {
  // The reported repro, with the detail that broke it: real records carry text
  // fingerprints, the copy's subtree is textually identical to the original's, and
  // before the copy exists the fingerprint fallback found the original's twin —
  // unique, plausible, wrong.
  document.body.innerHTML = '<p id="promo">Fast <span>shipping</span> included</p>';
  const base = { fallbackSelectors: [] as string[], enabled: true, createdAt: 'n', updatedAt: 'n' };
  const records: Parameters<typeof applyAll>[0] = [
    { ...base, id: 'cl30', selector: '#promo', elementLabel: 'p',
      type: 'clone', property: 'clone', oldValue: '', newValue: '' },
    { ...base, id: 'st30', selector: '[data-tweakpage-clone="cl30"] > span:nth-child(1)',
      elementLabel: 'span', textFingerprint: 'shipping',
      type: 'style', property: 'background-color', oldValue: 'rgba(0, 0, 0, 0)', newValue: 'rgb(67, 65, 149)' },
  ];
  applyAll(records, document);
  const copySpan = document.querySelector('[data-tweakpage-clone] span')!;
  const originalSpan = document.querySelector('#promo span')!;
  expect(copySpan.getAttribute('data-tweakpage'), 'styled: the copy').toContain('st30');
  expect(originalSpan.getAttribute('data-tweakpage') ?? '', 'untouched: the original').not.toContain('st30');
});
