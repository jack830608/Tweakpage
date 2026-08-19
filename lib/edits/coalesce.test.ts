import { describe, expect, test } from 'vitest';
import { findRecord, upsertRecord, type NewEdit } from './coalesce';

const base: NewEdit = {
  selector: '.hero-title',
  fallbackSelectors: ['html > body > h2:nth-child(1)'],
  textFingerprint: 'Unleash Your Sound',
  elementLabel: 'h2.hero-title "Unleash Your Sound"',
  type: 'style',
  property: 'color',
  oldValue: 'rgb(51, 51, 51)',
  newValue: '#ff0000',
};

describe('upsertRecord', () => {
  const NOW = '2026-08-15T10:00:00.000Z';
  const LATER = '2026-08-15T11:00:00.000Z';

  test('inserts a new record with id, enabled, timestamps', () => {
    const records = upsertRecord([], base, NOW, undefined);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ ...base, enabled: true, createdAt: NOW, updatedAt: NOW });
    expect(records[0].id).toBeTruthy();
  });

  test('continues the record it is handed: keeps oldValue and createdAt, updates newValue', () => {
    const first = upsertRecord([], base, NOW, undefined);
    const second = upsertRecord(
      first,
      { ...base, oldValue: '#ff0000', newValue: '#00ff00' },
      LATER,
      first[0],
    );
    expect(second).toHaveLength(1);
    expect(second[0].oldValue).toBe('rgb(51, 51, 51)');
    expect(second[0].newValue).toBe('#00ff00');
    expect(second[0].createdAt).toBe(NOW);
    expect(second[0].updatedAt).toBe(LATER);
    expect(second[0].id).toBe(first[0].id);
  });

  test('handed nothing, it adds — even where the selector already appears', () => {
    // It used to re-find by selector and property, which is what put one wizard step's
    // words on another's: two elements of the same shape mint the same selector, and
    // only the caller knows which element is being edited.
    const first = upsertRecord([], base, NOW, undefined);
    const second = upsertRecord(first, base, LATER, undefined);
    expect(second).toHaveLength(2);
    expect(second[0].id).not.toBe(second[1].id);
  });

  test('does not mutate the input array', () => {
    const input: ReturnType<typeof upsertRecord> = [];
    upsertRecord(input, base, NOW, undefined);
    expect(input).toHaveLength(0);
  });
});

test('findRecord matches on selector + property — a candidate, not an answer', () => {
  // The controller narrows this down with the element before trusting it.
  const records = upsertRecord([], base, '2026-08-15T10:00:00.000Z', undefined);
  expect(findRecord(records, '.hero-title', 'color')).toBe(records[0]);
  expect(findRecord(records, '.hero-title', 'fontSize')).toBeUndefined();
  expect(findRecord(records, '.other', 'color')).toBeUndefined();
});
