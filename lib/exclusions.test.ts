import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  DEFAULT_EXCLUSIONS,
  excludedBy,
  getExclusions,
  ruleProblem,
  saveExclusions,
} from './exclusions';

const KEY = 'tweakpage:exclusions';

beforeEach(() => {
  fakeBrowser.reset();
  document.body.innerHTML = `
    <div id="widget" class="intercom-lightweight-app">
      <button id="launcher">Chat</button>
    </div>
    <article id="post"><h1 id="title">Hello</h1></article>
    <aside data-tweakpage-ignore><p id="volatile">Re-rendered</p></aside>`;
});

const el = (id: string) => document.getElementById(id)!;

describe('what a rule catches', () => {
  test('the element it names', () => {
    expect(excludedBy(el('widget'), ['.intercom-lightweight-app'])).toBe('.intercom-lightweight-app');
  });

  test('and everything inside it', () => {
    // Excluding a widget means excluding the widget, not just the one node you named.
    expect(excludedBy(el('launcher'), ['.intercom-lightweight-app'])).toBe('.intercom-lightweight-app');
  });

  test('and nothing else', () => {
    expect(excludedBy(el('title'), ['.intercom-lightweight-app'])).toBeNull();
  });

  test('it reports which rule caught it, not just that one did', () => {
    // The outline says why the element cannot be picked; "excluded" alone sends the user
    // hunting through a list for the reason.
    expect(excludedBy(el('launcher'), ['#post', '.intercom-lightweight-app'])).toBe(
      '.intercom-lightweight-app',
    );
  });
});

describe('a rule that no longer parses', () => {
  test('costs its own match and nobody else\'s', () => {
    // Stored by an older version, or edited by hand. Selection has to keep working.
    expect(excludedBy(el('launcher'), ['((', '.intercom-lightweight-app'])).toBe(
      '.intercom-lightweight-app',
    );
  });

  test('and matches nothing on its own', () => {
    expect(excludedBy(el('launcher'), ['(('])).toBeNull();
  });
});

describe('what may be added', () => {
  test('an ordinary selector', () => {
    expect(ruleProblem('.chat-widget')).toBeNull();
    expect(ruleProblem('[data-testid="cookie-banner"] > div')).toBeNull();
  });

  test('nothing that catches the whole page', () => {
    // Every element has body as an ancestor, so this rule makes the page unselectable
    // and the extension look broken.
    for (const rule of ['*', 'body', 'HTML', ':root']) {
      expect(ruleProblem(rule), rule).toBe('catches everything');
    }
  });

  test('nothing that is not a selector', () => {
    expect(ruleProblem('((')).toBe('not a selector');
    expect(ruleProblem('   ')).toBe('empty');
    expect(ruleProblem('.a'.repeat(200))).toBe('too long');
  });

  test('and not one that is already in the list', () => {
    expect(ruleProblem('.chat', ['.chat'])).toBe('already there');
    expect(ruleProblem('  .chat  ', ['.chat']), 'whitespace is not a different rule').toBe(
      'already there',
    );
  });
});

describe('the stored list', () => {
  test('starts with the attribute convention in it', async () => {
    expect(await getExclusions()).toEqual(DEFAULT_EXCLUSIONS);
    expect(excludedBy(el('volatile'), await getExclusions()), 'and it works').toBe(
      '[data-tweakpage-ignore]',
    );
  });

  test('an emptied list stays empty', async () => {
    // Deleting every rule is a decision. Handing the defaults back would undo it on the
    // next page load, silently.
    await saveExclusions([]);
    expect(await getExclusions()).toEqual([]);
  });

  test('survives a round trip', async () => {
    await saveExclusions(['.a', '.b']);
    expect(await getExclusions()).toEqual(['.a', '.b']);
  });

  test('cannot grow without bound', async () => {
    await saveExclusions(Array.from({ length: 90 }, (_, i) => `.r${i}`));
    expect((await getExclusions()).length).toBeLessThanOrEqual(50);
  });

  test('a corrupt store leaves the page editable', async () => {
    await fakeBrowser.storage.local.set({ [KEY]: 'not a list' });
    expect(await getExclusions()).toEqual(DEFAULT_EXCLUSIONS);
    await fakeBrowser.storage.local.set({ [KEY]: ['.ok', 42, null] });
    expect(await getExclusions()).toEqual(['.ok']);
  });
});
