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
  test('inserts a new record with id, enabled, timestamps', () => {
    const records = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      ...base,
      enabled: true,
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    });
    expect(records[0].id).toBeTruthy();
  });

  test('coalesces same selector+property: keeps oldValue and createdAt, updates newValue', () => {
    const first = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    const second = upsertRecord(first, { ...base, oldValue: '#ff0000', newValue: '#00ff00' }, '2026-08-15T11:00:00.000Z');
    expect(second).toHaveLength(1);
    expect(second[0].oldValue).toBe('rgb(51, 51, 51)');
    expect(second[0].newValue).toBe('#00ff00');
    expect(second[0].createdAt).toBe('2026-08-15T10:00:00.000Z');
    expect(second[0].updatedAt).toBe('2026-08-15T11:00:00.000Z');
    expect(second[0].id).toBe(first[0].id);
  });

  test('different property on same selector creates a second record', () => {
    const first = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    const second = upsertRecord(first, { ...base, property: 'fontSize', oldValue: '32px', newValue: '40px' }, '2026-08-15T10:01:00.000Z');
    expect(second).toHaveLength(2);
  });

  test('different selector creates a second record', () => {
    const first = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    const second = upsertRecord(first, { ...base, selector: '.lead' }, '2026-08-15T10:01:00.000Z');
    expect(second).toHaveLength(2);
  });

  test('does not mutate the input array', () => {
    const input: ReturnType<typeof upsertRecord> = [];
    upsertRecord(input, base, '2026-08-15T10:00:00.000Z');
    expect(input).toHaveLength(0);
  });
});

test('findRecord matches on selector + property', () => {
  const records = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
  expect(findRecord(records, '.hero-title', 'color')).toBe(records[0]);
  expect(findRecord(records, '.hero-title', 'fontSize')).toBeUndefined();
  expect(findRecord(records, '.other', 'color')).toBeUndefined();
});
