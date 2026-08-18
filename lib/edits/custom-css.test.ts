import { describe, expect, test } from 'vitest';
import { parseDeclarations } from './custom-css';

describe('parsing hand-written declarations', () => {
  test('reads the shapes people actually type', () => {
    const result = parseDeclarations('transform: rotate(3deg);\n filter : blur(2px) ;\ngrid-column: 1 / -1');
    expect(result).toEqual({
      ok: true,
      declarations: [
        { property: 'transform', value: 'rotate(3deg)' },
        { property: 'filter', value: 'blur(2px)' },
        { property: 'grid-column', value: '1 / -1' },
      ],
    });
  });

  test('an empty box means no declarations, not an error', () => {
    expect(parseDeclarations('  \n ')).toEqual({ ok: true, declarations: [] });
  });

  test('points at the line it cannot read', () => {
    const result = parseDeclarations('transform: rotate(3deg); just words');
    expect(result).toEqual({ ok: false, error: 'just words' });
  });

  test('refuses what could escape a declaration', () => {
    // These records end up inside an injected stylesheet; a value that closes the block
    // or opens an at-rule would write CSS we never agreed to.
    for (const hostile of [
      'width: 10px} body{display:none',
      'background: url(x) @import "evil"',
      'behavior: expression(alert(1))',
      'color: red; --x: <script>',
      'background: javascript:alert(1)',
    ]) {
      expect(parseDeclarations(hostile).ok, hostile).toBe(false);
    }
  });

  test('vendor prefixes pass, custom properties do not', () => {
    expect(parseDeclarations('-webkit-line-clamp: 2').ok).toBe(true);
    expect(parseDeclarations('--brand: red').ok).toBe(false);
  });
});
