/**
 * Does a selector still find its element when the page moves under it?
 *
 * The editor's one irreplaceable job is knowing which element you picked. Everything
 * else — the panel, the hand-off, the share link — is downstream of that, and every bug
 * worth the name so far has been a way of getting it wrong. Unit tests cover the shapes
 * we thought of; this measures the shapes the web actually has, on real pages, one row
 * per way a page can move.
 *
 * Three numbers per row, and the third is the one that matters:
 *
 *   found  — resolved to something
 *   right  — resolved to the element the record was made from, or correctly refused
 *   WRONG  — resolved to a different element. Silent, and it travels in the hand-off.
 *
 * Ground truth is a stamp put on each element before the page is disturbed, so it is
 * the node itself being checked and not a guess about which node came back.
 *
 * Run: pnpm audit:selectors [url ...]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BUNDLE = process.env.TWEAKPAGE_AUDIT_BUNDLE ?? '/tmp/twk-audit.js';
const SAMPLE = 40;

/** A spread of stacks, chosen for what they do to class names and to the DOM. */
const SITES = [
  ['positivegrid (next+modules)', 'https://www.positivegrid.com/pages/product-selector'],
  ['nuxt (vue)', 'https://nuxt.com/'],
  ['svelte', 'https://svelte.dev/'],
  ['angular', 'https://angular.dev/'],
  ['tailwind', 'https://tailwindcss.com/'],
  ['mdn', 'https://developer.mozilla.org/en-US/docs/Web/CSS/display'],
  ['hacker news (static)', 'https://news.ycombinator.com/'],
  ['wordpress.org', 'https://wordpress.org/'],
];

/**
 * The ways a page moves between the moment an edit is made and the moment it replays.
 *
 * `expect` says what a correct resolver does. `refuse` rows are the ones where finding
 * anything is the failure: the element the record was made from no longer holds its
 * content, so writing over whatever sits there now is how one edit ended up on every
 * step of a wizard.
 */
const SCENARIOS = [
  { key: 'reload', note: 'a fresh document' },
  { key: 'insert-sibling', note: 'a block inserted above it' },
  { key: 'wrap-parent', note: 'an extra wrapper div' },
  { key: 'strip-classes', note: 'every class renamed by a rebuild' },
  { key: 'swap-siblings', note: 'a keyed list re-labelled in place' },
  { key: 'rewrite-text', note: 'that copy replaced everywhere on the page' },
];

const STAMP = 'data-twk-audit';

/**
 * Records are not all text records.
 *
 * The first version of this audit modelled every sample as a whole-element text edit,
 * which is the one kind held to its words — so it reported zero wrong answers while a
 * colour edit could still take a positional hit and land on a stranger. A review found
 * that by hand. Both kinds run now.
 */
const KINDS = [
  { key: 'text', patch: { type: 'text', property: 'textContent', newValue: '' } },
  { key: 'style', patch: { type: 'style', property: 'color', newValue: 'red' } },
];

const browser = await chromium.launch({ channel: 'chromium' });
const bundle = readFileSync(BUNDLE, 'utf8');
const urls = process.argv.slice(2);
const sites = urls.length > 0 ? urls.map((u) => [new URL(u).host, u]) : SITES;
const rows = [];

for (const [name, url] of sites) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  // Not a script tag: several of these sites forbid inline scripts, and an init script
  // also survives the reload the first scenario needs.
  await context.addInitScript(bundle);
  const page = await context.newPage();
  try {
    for (const scenario of SCENARIOS) {
      for (const kind of KINDS) {
        rows.push({
          site: name,
          ...scenario,
          kind: kind.key,
          ...(await run(page, url, scenario.key, kind.patch)),
        });
      }
    }
  } catch (error) {
    rows.push({ site: name, key: '—', error: String(error).split('\n')[0].slice(0, 80) });
  }
  await context.close();
}

await browser.close();
report(rows);

async function run(page, url, scenario, patch) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const picked = await page.evaluate(
    ([sample, stamp]) => {
      document.querySelectorAll(`[${stamp}]`).forEach((el) => el.removeAttribute(stamp));
      const candidates = [...document.body.querySelectorAll('*')].filter((el) => {
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'LINK', 'META'].includes(el.tagName)) return false;
        // Inside a drawing is not a thing the picker offers; the drawing itself is.
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return false;
        const r = el.getBoundingClientRect();
        // No text requirement. Images, icons and empty boxes have no fingerprint and so
        // nothing to relocate by — leaving them out measured only the easy half.
        return r.width >= 4 && r.height >= 4;
      });
      const step = Math.max(1, Math.floor(candidates.length / sample));
      const chosen = candidates.filter((_, i) => i % step === 0).slice(0, sample);
      // Where an element sits, as child indexes from the root. Stamps die with the
      // document, so a reload is graded against this: a page that renders the same twice
      // puts the same element at the same path.
      const pathOf = (el) => {
        const parts = [];
        for (let cur = el; cur && cur.parentElement; cur = cur.parentElement) {
          parts.unshift([...cur.parentElement.children].indexOf(cur));
        }
        return parts.join('.');
      };
      return chosen.map((el, i) => {
        // Minted before anything moves, exactly as the editor would mint it.
        const record = window.__twk.generateSelector(el);
        el.setAttribute(stamp, String(i));
        return { id: String(i), record, tag: el.tagName.toLowerCase(), path: pathOf(el) };
      });
    },
    [SAMPLE, STAMP],
  );

  if (scenario === 'reload') {
    // The stamps go with the old document; the reloaded page is graded by re-minting
    // the same sample and checking each record lands on the element it was made from.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    return grade(page, picked, patch, true);
  }

  await page.evaluate(
    ([kind, stamp]) => {
      if (kind === 'swap-siblings') {
        // The wizard: one list of buttons, the same nodes, everybody's words moved along
        // by one. Every record's remembered text is now on a sibling.
        const groups = new Map();
        for (const el of document.querySelectorAll(`[${stamp}]`)) {
          const parent = el.parentElement;
          if (!parent) continue;
          const peers = [...parent.children].filter((c) => c.tagName === el.tagName);
          if (peers.length > 1) groups.set(parent, peers);
        }
        for (const peers of groups.values()) {
          const texts = peers.map((p) => p.textContent ?? '');
          peers.forEach((p, i) => {
            p.textContent = texts[(i + 1) % texts.length];
          });
        }
        return;
      }
      for (const el of [...document.querySelectorAll(`[${stamp}]`)]) {
        if (kind === 'insert-sibling') {
          // Once per parent: a banner appearing above a list, not forty of them.
          const parent = el.parentElement;
          if (!parent || parent.firstElementChild?.hasAttribute('data-twk-filler')) continue;
          const filler = document.createElement('div');
          filler.setAttribute('data-twk-filler', '');
          filler.textContent = 'Inserted by the site';
          parent.insertBefore(filler, parent.firstChild);
        } else if (kind === 'wrap-parent') {
          const parent = el.parentElement;
          // Never the body: moving it into a wrapper detaches it and takes the document
          // with it, which measures nothing except this script's own carelessness.
          if (!parent || !parent.parentElement || !parent.isConnected) continue;
          if (parent === document.body || parent === document.documentElement) continue;
          const wrapper = document.createElement('div');
          parent.parentElement.insertBefore(wrapper, parent);
          wrapper.appendChild(parent);
        } else if (kind === 'strip-classes') {
          for (const node of [el, ...document.querySelectorAll('[class]')]) {
            node.setAttribute('class', `r${Math.abs(node.className.length * 7919) % 9973}`);
          }
        } else if (kind === 'rewrite-text') {
          // Everywhere those words appear, not only here: a copy change ships site-wide,
          // and leaving a twin behind would only measure whether we found the twin.
          const words = (el.textContent ?? '').trim().slice(0, 60);
          const twins = [...document.body.querySelectorAll('*')].filter(
            (n) => (n.textContent ?? '').trim().slice(0, 60) === words,
          );
          for (const twin of twins) {
            const leaves = [twin, ...twin.querySelectorAll('*')].filter(
              (n) => n.children.length === 0 && (n.textContent ?? '').trim(),
            );
            for (const leaf of leaves.length ? leaves : [twin]) {
              leaf.textContent = `Rewritten by the site ${twin.getAttribute(stamp) ?? 'x'}`;
            }
          }
        }
      }
    },
    [scenario, STAMP],
  );
  await page.waitForTimeout(300);
  return grade(page, picked, patch, false);
}

async function grade(page, picked, patch, reloaded) {
  return page.evaluate(
    ([items, patchInto, stamp, wasReloaded]) => {
      // Four outcomes rather than a pass mark, because two of them are correct for
      // different reasons and only one of them is a bug.
      let exact = 0; // the element the record was made from
      let sameWords = 0; // a different element now holding the remembered words: drift,
      let elsewhere = 0; // by design — versus somebody else's element, which is the bug
      let refused = 0;
      let elsewhereNoText = 0; // landed elsewhere, and had no words to be checked against
      let recoverable = 0; // refused, but the recorded chain names exactly one candidate
      let gone = 0; // refused because those words are nowhere on the page any more
      const wrong = [];
      for (const item of items) {
        const el = window.__twk.resolveRecord(
          { ...item.record, id: `audit-${item.id}`, ...patchInto },
          document,
        );
        if (el === null) {
          refused += 1;
          // Would the chain we already record have broken the tie? Counted, not used:
          // whether to give context a vote in resolution is a decision to take on
          // evidence, and this is the evidence.
          const words = item.record.textFingerprint;
          if (words) {
            const twins = [...document.body.querySelectorAll(item.tag)].filter(
              (n) => (n.textContent ?? '').trim().slice(0, 60) === words,
            );
            const chain = item.record.context ?? [];
            const fits = twins.filter((n) => {
              let cur = n;
              for (const want of chain) {
                if (!cur) return false;
                if (cur.tagName.toLowerCase() !== want.tag) return false;
                if (want.id && cur.id !== want.id) return false;
                if (want.testId && cur.getAttribute('data-testid') !== want.testId) return false;
                if (want.label && cur.getAttribute('aria-label') !== want.label) return false;
                cur = cur.parentElement;
              }
              return true;
            });
            if (twins.length > 1 && fits.length === 1) recoverable += 1;
            else if (twins.length === 0) gone += 1;
          }
          continue;
        }
        const words = (el.textContent ?? '').trim().slice(0, 60);
        const pathOf = (node) => {
          const parts = [];
          for (let cur = node; cur && cur.parentElement; cur = cur.parentElement) {
            parts.unshift([...cur.parentElement.children].indexOf(cur));
          }
          return parts.join('.');
        };
        // A reload is graded by position, not by words: an image, an icon or an empty box
        // has no words, and grading those against an absent fingerprint counted every one
        // of them as a wrong answer.
        if (wasReloaded ? pathOf(el) === item.path : el.getAttribute(stamp) === item.id) {
          exact += 1;
        } else if (words !== '' && words === item.record.textFingerprint) {
          sameWords += 1;
        } else {
          elsewhere += 1;
          if (!item.record.textFingerprint) elsewhereNoText += 1;
          wrong.push(
            `${item.tag}${item.record.textFingerprint ? '' : ' [no text]'} ` +
              `${item.record.selector.slice(0, 38)} -> "${words.slice(0, 20)}"`,
          );
        }
      }
      const found = exact + sameWords + elsewhere;
      const right = exact;
      const context = items.flatMap((i) => i.record.context ?? []);
      return {
        sampled: items.length,
        found,
        right,
        exact,
        sameWords,
        elsewhere,
        elsewhereNoText,
        refused,
        recoverable,
        gone,
        wrong: elsewhere,
        examples: wrong.slice(0, 2),
        greppable: items.filter((i) =>
          (i.record.context ?? []).some(
            (n) =>
              n.testId || n.id || n.label || n.heading || (n.classes ?? []).some((c) => c.includes('_')),
          ),
        ).length,
        named: items.filter((i) =>
          (i.record.context ?? []).some((n) => n.testId || n.id || n.label || n.heading),
        ).length,
        depth: context.length,
      };
    },
    [picked, patch, STAMP, reloaded],
  );
}

function report(rows) {
  const pct = (n, d) => (d ? `${String(Math.round((n / d) * 100)).padStart(3)}%` : '   —');
  const graded = rows.filter((r) => !r.error);
  for (const r of rows.filter((row) => row.error)) {
    console.log(`${r.site.padEnd(29)} ${r.error}`);
  }
  // By scenario and edit type: which way the page moved matters, and so does what kind
  // of record was asked to survive it.
  console.log(
    '\nscenario         kind      n   exact  drift  refused  ELSEWHERE  of those,\n' +
      ' '.repeat(63) + 'no text',
  );
  console.log('-'.repeat(73));
  for (const scenario of SCENARIOS) {
    for (const kind of KINDS) {
      const set = graded.filter((r) => r.key === scenario.key && r.kind === kind.key);
      if (set.length === 0) continue;
      const sum = (k) => set.reduce((n, r) => n + r[k], 0);
      const n = sum('sampled');
      console.log(
        `${scenario.key.padEnd(16)} ${kind.key.padEnd(6)} ${String(n).padStart(4)}` +
          `   ${pct(sum('exact'), n)}  ${pct(sum('sameWords'), n)}  ${pct(sum('refused'), n)}` +
          `   ${String(sum('elsewhere')).padStart(6)}`,
      );
      for (const e of set.flatMap((r) => r.examples ?? []).slice(0, 2)) {
        console.log(`${' '.repeat(30)}${e}`);
      }
    }
  }
  const total = (k) => graded.reduce((n, r) => n + r[k], 0);
  console.log('-'.repeat(73));
  console.log(
    `${'ALL'.padEnd(24)} ${String(total('sampled')).padStart(4)}   ${pct(total('exact'), total('sampled'))}` +
      `  ${pct(total('sameWords'), total('sampled'))}  ${pct(total('refused'), total('sampled'))}` +
      `   ${String(total('elsewhere')).padStart(6)}  ${String(total('elsewhereNoText')).padStart(7)}`,
  );

  const refusedRows = graded.filter((r) => r.refused > 0);
  const totalRefused = refusedRows.reduce((n, r) => n + r.refused, 0);
  const totalRecoverable = refusedRows.reduce((n, r) => n + r.recoverable, 0);
  const totalGone = refusedRows.reduce((n, r) => n + r.gone, 0);
  console.log(
    `\nof ${totalRefused} refusals: ${totalGone} because those words left the page` +
      ` (nothing to find), ${totalRecoverable} the recorded chain could have disambiguated`,
  );

  console.log('\nwhat a reader of the hand-off gets (per site, from the `reload` sample)');
  console.log('-'.repeat(84));
  for (const r of graded.filter((row) => row.key === 'reload' && row.kind === 'text')) {
    console.log(
      `${r.site.padEnd(29)} named region ${pct(r.named, r.sampled)}` +
        `   greppable ${pct(r.greppable, r.sampled)}   ancestors/record ${(r.depth / r.sampled).toFixed(1)}`,
    );
  }

  // test-results/ is gitignored, so a fresh clone has no directory to write into —
  // and this line runs after several minutes against live sites.
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/selector-audit.json', JSON.stringify(rows, null, 2));
  console.log('\ntest-results/selector-audit.json');
}
