import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Panel } from './Panel';
import { EditsController } from '../controller';
import { getShareSettings, SHARE_FIELDS } from '../../../lib/share/settings';
import { t } from '../../../lib/i18n';

/**
 * One rule, checked against every setting.
 *
 * Settings are expected to keep arriving, and the way a settings screen goes wrong is
 * one row at a time: a control with no label, a secret rendered in plain text, a group
 * with no heading. So rather than listing the settings that exist today, these tests
 * sweep whatever the view renders and hold all of it to the same rules — a new row is
 * covered the moment it is added, whether or not anyone remembered this file.
 */
const NOW = () => '2026-08-17T10:00:00.000Z';

afterEach(cleanup);

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="target">Hello</div>';
  history.replaceState({}, '', '/page');
});

function openSettings() {
  render(
    <Panel
      controller={new EditsController(null, document, NOW)}
      selected={document.getElementById('target')}
      mode="edit"
      onModeChange={vi.fn()}
      showOnboarding={false}
      onDismissOnboarding={vi.fn()}
      onSelect={vi.fn()}
      onHighlight={vi.fn()}
      onToast={vi.fn()}
      onSnapshot={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTestId('open-settings'));
}

const rows = () => [...document.querySelectorAll('.pgve-setting')];

describe('the settings view', () => {
  test('is reached from the panel, not from a menu outside it', () => {
    openSettings();
    expect(document.querySelector('.pgve-settings')).toBeTruthy();
    expect(screen.getByTestId('back-from-settings')).toBeTruthy();
  });

  test('renders every row it is given', () => {
    openSettings();
    // Theme, plus one per share field. A new setting shifts this number, which is the
    // point: the count is a reminder to check the rules below still hold.
    expect(rows()).toHaveLength(1 + SHARE_FIELDS.length);
  });

  test('every row has a visible label and exactly one control', () => {
    openSettings();
    for (const row of rows()) {
      const label = row.querySelector('.pgve-setting-label')?.textContent ?? '';
      expect(label.trim(), 'a row without a label is a control nobody can name').not.toBe('');
      const controls = row.querySelectorAll('input, select, [role="group"]');
      expect(controls, `"${label}" should own one control`).toHaveLength(1);
    }
  });

  test('every control says what it is to a screen reader', () => {
    openSettings();
    for (const row of rows()) {
      const control = row.querySelector('input, select, [role="group"]')!;
      expect(control.getAttribute('aria-label'), row.textContent ?? '').toBeTruthy();
    }
  });

  test('every group announces itself with a heading', () => {
    openSettings();
    const groups = [...document.querySelectorAll('.pgve-settings-group')];
    expect(groups.length).toBeGreaterThan(1);
    for (const group of groups) {
      expect(group.querySelector('h3')?.textContent?.trim()).toBeTruthy();
    }
  });
});

describe('share credentials', () => {
  test('the secret is never rendered as readable text', () => {
    openSettings();
    for (const field of SHARE_FIELDS) {
      const input = screen.getByTestId(`setting-${field.key}`);
      expect(input.getAttribute('type'), field.label).toBe(field.secret ? 'password' : 'text');
    }
  });

  test('typing is enough — there is no submit button to miss', async () => {
    openSettings();
    fireEvent.change(screen.getByTestId('setting-bucket'), { target: { value: 'my-bucket' } });
    await waitFor(async () => {
      expect((await getShareSettings()).bucket).toBe('my-bucket');
    });
  });

  test('sharing stays off until the whole set is there', async () => {
    openSettings();
    expect(screen.getByTestId('share-status').textContent).toBe(t('opt_incomplete'));

    for (const field of SHARE_FIELDS) {
      fireEvent.change(screen.getByTestId(`setting-${field.key}`), { target: { value: 'x' } });
    }
    await waitFor(() => {
      expect(screen.getByTestId('share-status').textContent).toBe(t('settings_share_ready'));
    });
  });

  test('clearing takes the credentials out of storage, not just off the screen', async () => {
    openSettings();
    for (const field of SHARE_FIELDS) {
      fireEvent.change(screen.getByTestId(`setting-${field.key}`), { target: { value: 'x' } });
    }
    await waitFor(async () => expect((await getShareSettings()).bucket).toBe('x'));

    fireEvent.click(screen.getByTestId('clear-share-settings'));
    await waitFor(async () => {
      const settings = await getShareSettings();
      expect(Object.values(settings).join('')).toBe('');
    });
  });
});
