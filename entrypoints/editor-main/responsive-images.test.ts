import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { clearResponsiveSources } from './responsive-images';
import { EditsController } from './controller';

const NOW = () => '2026-08-16T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  history.replaceState({}, '', '/page');
});

function controller() {
  return new EditsController(null, document, NOW);
}

test('clears the srcset that would otherwise outrank the new src', () => {
  document.body.innerHTML =
    '<img id="hero" src="/old.jpg" srcset="/old.jpg?w=400 400w, /old.jpg?w=800 800w" sizes="50vw">';
  const c = controller();
  const img = document.getElementById('hero')!;

  c.recordEdit(img, 'attr', 'src', '/old.jpg', '/new.jpg');
  clearResponsiveSources(img, c);

  expect(img.getAttribute('src')).toBe('/new.jpg');
  expect(img.getAttribute('srcset'), 'srcset is what the browser actually chooses from').toBe('');
});

test('keeps the original srcset on the record so reset restores it', () => {
  document.body.innerHTML = '<img id="hero" src="/old.jpg" srcset="/old.jpg?w=400 400w">';
  const c = controller();
  const img = document.getElementById('hero')!;
  c.recordEdit(img, 'attr', 'src', '/old.jpg', '/new.jpg');
  clearResponsiveSources(img, c);

  const srcset = c.getPage().records.find((r) => r.property === 'srcset')!;
  expect(srcset.oldValue).toBe('/old.jpg?w=400 400w');

  c.revertAllEdits();
  expect(img.getAttribute('srcset')).toBe('/old.jpg?w=400 400w');
  expect(img.getAttribute('src')).toBe('/old.jpg');
});

test('clears the <source> elements that outrank the img entirely', () => {
  document.body.innerHTML =
    '<picture><source id="wide" srcset="/old.avif 800w" type="image/avif">' +
    '<source id="narrow" srcset="/old.webp 400w"><img id="hero" src="/old.jpg"></picture>';
  const c = controller();
  const img = document.getElementById('hero')!;

  c.recordEdit(img, 'attr', 'src', '/old.jpg', '/new.jpg');
  clearResponsiveSources(img, c);

  expect(document.getElementById('wide')!.getAttribute('srcset')).toBe('');
  expect(document.getElementById('narrow')!.getAttribute('srcset')).toBe('');
  expect(c.getPage().records).toHaveLength(3);
});

test('an image with no responsive candidates records nothing extra', () => {
  document.body.innerHTML = '<img id="hero" src="/old.jpg">';
  const c = controller();
  const img = document.getElementById('hero')!;
  c.recordEdit(img, 'attr', 'src', '/old.jpg', '/new.jpg');
  clearResponsiveSources(img, c);
  expect(c.getPage().records).toHaveLength(1);
});
