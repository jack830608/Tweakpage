import { beforeEach, describe, expect, test } from 'vitest';
import { buildContext, MAX_CONTEXT_DEPTH } from './context';
import { sourceClassName } from './stable-class';

describe('what survives a rebuild, and what a hash was hiding', () => {
  test('a CSS Modules class keeps everything its author wrote', () => {
    // product-selector.module.css → styles.optIn. The hash moves on every build that
    // touches the file; "rg optIn" finds the component either way.
    expect(sourceClassName('product-selector_optIn__qe980')).toBe('product-selector_optIn');
    expect(sourceClassName('Button_root__3xY7z')).toBe('Button_root');
  });

  test('a BEM name has no hash to lose', () => {
    expect(sourceClassName('card__title')).toBe('card__title');
  });

  test('Tailwind is written verbatim in the source and survives whole', () => {
    for (const cls of ['text-white', 'leading-none', 'px-4', 'items-center']) {
      expect(sourceClassName(cls), cls).toBe(cls);
    }
  });

  test('a class that is only a hash says nothing and is dropped', () => {
    for (const cls of ['css-1x2y3z', 'sc-bdVaJa', 'emotion-9fx2', 'jss142', '_1a2b3c']) {
      expect(sourceClassName(cls), cls).toBeNull();
    }
  });
});

describe('the chain recorded for whoever has to make the change', () => {
  beforeEach(() => {
    // The real shape of positivegrid.com/pages/product-selector, where the edited
    // element carries nothing at all.
    document.body.innerHTML = `
      <main id="main-content">
        <div class="flex flex-col font-proxima">
          <div class="product-selector_scrollArea__n2OLN flex-1" role="log" aria-label="Chat messages">
            <div class="pl-10 flex flex-col gap-2" role="group" aria-label="What is your primary goal?">
              <button class="product-selector_optIn__qe980 group flex items-center"><span>Jamming</span></button>
            </div>
          </div>
        </div>
      </main>`;
  });

  const chain = () => buildContext(document.querySelector('span')!);

  test('starts at the element, even when the element is bare', () => {
    // This is the case that made the feature worth having: nothing on the span is why
    // its selector came out as button:nth-of-type(2) > span.
    expect(chain()[0]).toEqual({ tag: 'span' });
  });

  test('carries the region its author named', () => {
    expect(chain().some((node) => node.label === 'What is your primary goal?')).toBe(true);
    expect(chain().some((node) => node.role === 'group')).toBe(true);
  });

  test('and the component to grep for, with the build hash off it', () => {
    const classes = chain().flatMap((node) => node.classes ?? []);
    expect(classes).toContain('product-selector_optIn');
    expect(classes.join(' '), 'no hash anywhere').not.toMatch(/qe980|n2OLN/);
  });

  test('reaches the landmark and stops at the document', () => {
    const chain_ = chain();
    expect(chain_.length).toBeLessThanOrEqual(MAX_CONTEXT_DEPTH);
    expect(chain_.some((node) => node.id === 'main-content')).toBe(true);
    expect(chain_.some((node) => node.tag === 'body' || node.tag === 'html')).toBe(false);
  });

  test('prefers a test id over everything, because it was put there to be found', () => {
    document.body.innerHTML = '<div data-testid="goal-option"><span>Jamming</span></div>';
    expect(buildContext(document.querySelector('span')!)[1]!.testId).toBe('goal-option');
  });

  test('omits what is not there rather than carrying empties', () => {
    document.body.innerHTML = '<div class=""><span id="">Jamming</span></div>';
    expect(buildContext(document.querySelector('span')!)[0]).toEqual({ tag: 'span' });
  });
});

describe('the heading a reader would name', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <h1>Find your amp</h1>
        <section>
          <h2>What is your primary goal?</h2>
          <div class="opts"><button><span id="target">Jamming</span></button></div>
        </section>
      </main>`;
  });

  test('is the nearest one above, not the biggest one', () => {
    const chain = buildContext(document.getElementById('target')!);
    expect(chain.map((n) => n.heading).find(Boolean)).toBe('What is your primary goal?');
  });

  test('is recorded once, on the element\'s own entry', () => {
    const chain = buildContext(document.getElementById('target')!);
    expect(chain.filter((n) => n.heading)).toHaveLength(1);
    expect(chain[0]!.heading).toBe('What is your primary goal?');
  });

  test('is found however deep the element sits', () => {
    // The recorded chain stops at six ancestors; the heading search must not. On MDN
    // the only heading above a sampled element was routinely further out than that,
    // and bounding the search left the record with no region at all.
    document.body.innerHTML =
      '<main><h1>Deep page</h1>' +
      '<div><div><div><div><div><div><div><div><span id="deep">x</span></div></div></div></div></div></div></div></div>' +
      '</main>';
    expect(buildContext(document.getElementById('deep')!)[0]!.heading).toBe('Deep page');
  });

  test('is found from further out when nothing nearby has one', () => {
    document.body.innerHTML = '<main><h1>Find your amp</h1><div><p><span id="t">x</span></p></div></main>';
    const chain = buildContext(document.getElementById('t')!);
    expect(chain.map((n) => n.heading).find(Boolean)).toBe('Find your amp');
  });

  test('and is simply absent on a page with no headings', () => {
    // Measured at 19 of 20 elements on tailwindcss.com and 18 of 20 on nuxt.com, where
    // an ancestor with an id, a role or an aria-label was there for 13% and 8%. It is
    // not always there; it must not invent one when it is not.
    document.body.innerHTML = '<div><span id="t">x</span></div>';
    expect(buildContext(document.getElementById('t')!).some((n) => n.heading)).toBe(false);
  });
});
