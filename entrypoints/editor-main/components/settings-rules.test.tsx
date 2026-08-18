import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Panel } from './Panel';
import { EditsController } from '../controller';
import { getShareSettings, HAND_OFFS, SHARE_FIELDS, TINYPNG_FIELD } from '../../../lib/share/settings';
import { t } from '../../../lib/i18n';

/**
 * One rule, checked against every setting.
 *
 * Settings are expected to keep arriving, and the way a settings screen goes wrong is
 * one row at a time: a control with no label, a group with no heading — or a secret
 * rendered where the page being edited can read it. So rather than listing the settings
 * that exist today, these tests sweep whatever the view renders and hold all of it to
 * the same rules; a new row is covered the moment it is added.
 */
const NOW = () => '2026-08-19T10:00:00.000Z';

const CREDENTIALS = {
  bucket: 'demo-bucket',
  region: 'us-east-1',
  accessKeyId: 'AKIA_SENTINEL',
  secretAccessKey: 'SECRET_SENTINEL',
  tinypngKey: 'TINIFY_SENTINEL',
  compressImages: true,
  uploadImages: { summary: true, json: true, download: true, share: true },
};

afterEach(cleanup);

beforeEach(async () => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="target">Hello</div>';
  history.replaceState({}, '', '/page');
  await fakeBrowser.storage.local.set({ 'tweakpage:share-settings': CREDENTIALS });
});

async function openSettings() {
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
      onSnapshot={vi.fn().mockResolvedValue(true)}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTestId('open-settings'));
  await waitFor(() => expect(screen.getByTestId('share-status')).toBeTruthy());
  // Groups collapse, so open everything before checking what a row looks like.
  for (let pass = 0; pass < 5; pass++) {
    const closed = [...document.querySelectorAll<HTMLButtonElement>('.twk-settings [data-section]')]
      .filter((header) => header.getAttribute('aria-expanded') !== 'true');
    if (closed.length === 0) break;
    closed.forEach((header) => fireEvent.click(header));
  }
}

const rows = () => [...document.querySelectorAll('.twk-setting')];
const groups = () => [...document.querySelectorAll('.twk-settings .twk-disclosure')];

describe('what the page is allowed to see', () => {
  test('no credential appears anywhere in the panel', async () => {
    // The panel is rendered inside the site being edited. Anything here is one
    // querySelector away from that site's own JavaScript.
    await openSettings();
    const html = document.body.innerHTML;
    for (const secret of ['SECRET_SENTINEL', 'TINIFY_SENTINEL', 'AKIA_SENTINEL']) {
      expect(html, `${secret} must not be in the page`).not.toContain(secret);
    }
    for (const value of [...document.querySelectorAll('input')].map((i) => i.value)) {
      expect(value).not.toContain('SENTINEL');
    }
  });

  test('no credential field is offered here at all', async () => {
    await openSettings();
    for (const field of [...SHARE_FIELDS, TINYPNG_FIELD]) {
      expect(screen.queryByTestId(`setting-${field.key}`), field.key).toBeNull();
    }
  });

  test('but it can still say whether sharing will work', async () => {
    await openSettings();
    expect(screen.getByTestId('share-status').textContent).toBe(t('settings_share_on'));
  });

  test('and it points at the one place credentials can be entered', async () => {
    await openSettings();
    const messages: Array<{ type?: string }> = [];
    fakeBrowser.runtime.onMessage.addListener((m: unknown) => {
      messages.push(m as { type?: string });
    });
    fireEvent.click(screen.getByTestId('open-secure-settings'));
    await waitFor(() => expect(messages.some((m) => m.type === 'tweakpage:open-options')).toBe(true));
  });
});

describe('the settings view', () => {
  test('is reached from the panel, not from a menu outside it', async () => {
    await openSettings();
    expect(document.querySelector('.twk-settings')).toBeTruthy();
    expect(screen.getByTestId('back-from-settings')).toBeTruthy();
  });

  test('every group can be collapsed, and says so', async () => {
    await openSettings();
    // Closed and opened again one at a time: closing a group unmounts anything nested
    // inside it, so leaving one shut would take the next group off the screen with it.
    for (let i = 0; i < groups().length; i++) {
      const header = groups()[i]!.querySelector('.twk-disclosure-header')!;
      const name = header.textContent ?? '';
      expect(header.getAttribute('aria-expanded'), name).toBe('true');
      fireEvent.click(header);
      expect(header.getAttribute('aria-expanded'), `${name} should close on click`).toBe('false');
      fireEvent.click(header);
      expect(header.getAttribute('aria-expanded'), `${name} should reopen`).toBe('true');
    }
  });

  test('every row has a visible label and exactly one control', async () => {
    await openSettings();
    for (const row of rows()) {
      const label = row.querySelector('.twk-setting-label')?.textContent ?? '';
      expect(label.trim(), 'a row without a label is a control nobody can name').not.toBe('');
      const controls = row.querySelectorAll('input, select, [role="group"]');
      expect(controls, `"${label}" should own one control`).toHaveLength(1);
    }
  });

  test('every control says what it is to a screen reader', async () => {
    await openSettings();
    for (const control of document.querySelectorAll(
      '.twk-settings input, .twk-settings [role="group"]',
    )) {
      expect(control.getAttribute('aria-label'), control.outerHTML.slice(0, 80)).toBeTruthy();
    }
  });

  test('every group announces itself with a heading', async () => {
    await openSettings();
    expect(groups().length).toBeGreaterThan(1);
    for (const group of groups()) {
      expect(group.querySelector('.twk-disclosure-header')?.textContent?.trim()).toBeTruthy();
    }
  });
});

describe('the preferences the panel may still change', () => {
  test('an upload switch is written straight through', async () => {
    await openSettings();
    fireEvent.click(screen.getByTestId('upload-images-json'));
    await waitFor(async () => {
      expect((await getShareSettings()).uploadImages.json).toBe(false);
    });
  });

  test('changing a preference leaves the credentials alone', async () => {
    // The panel writes through a preferences-only path; a full settings write from here
    // would be a way to clobber keys it is not allowed to read.
    await openSettings();
    fireEvent.click(screen.getByTestId('upload-images-all'));
    await waitFor(async () => {
      const settings = await getShareSettings();
      expect(HAND_OFFS.every((k) => settings.uploadImages[k] === false)).toBe(true);
      expect(settings.secretAccessKey, 'untouched').toBe('SECRET_SENTINEL');
      expect(settings.tinypngKey, 'untouched').toBe('TINIFY_SENTINEL');
    });
  });

  test('compression cannot be switched on without a key to use', async () => {
    await fakeBrowser.storage.local.set({
      'tweakpage:share-settings': { ...CREDENTIALS, tinypngKey: '', compressImages: false },
    });
    await openSettings();
    const box = screen.getByTestId('compress-images') as HTMLInputElement;
    expect(box.disabled, 'a switch that cannot do anything must look like it').toBe(true);
  });
});

describe('a control that governs other controls', () => {
  test('the master sits apart from the four it changes', async () => {
    // As a plain checkbox in a row of checkboxes it gave no clue that unticking it
    // unticked four more. It heads its own set now, and the set is drawn as one thing.
    await openSettings();
    const all = screen.getByTestId('upload-images-all');
    const set = all.closest('.twk-switch-set');
    expect(set, 'the master is inside the set it governs').toBeTruthy();
    for (const handOff of HAND_OFFS) {
      expect(set!.contains(screen.getByTestId(`upload-images-${handOff}`)), handOff).toBe(true);
    }
    expect(all.closest('.twk-switch')!.className, 'and is drawn differently').toContain(
      'twk-switch--all',
    );
  });

  test('it says "some" when it means some', async () => {
    await openSettings();
    fireEvent.click(screen.getByTestId('upload-images-json'));
    await waitFor(() => {
      const all = screen.getByTestId('upload-images-all') as HTMLInputElement;
      // Unticked would claim all four are off, which is the state it must not report.
      expect(all.indeterminate).toBe(true);
      expect(all.checked).toBe(false);
    });
  });

  test('the group says how many of them upload without being opened', async () => {
    await openSettings();
    fireEvent.click(screen.getByTestId('upload-images-json'));
    await waitFor(() =>
      expect(screen.getByTestId('upload-count').textContent).toBe(t('settings_upload_count', ['3', '4'])),
    );
  });
});

describe('a decision that has been taken', () => {
  test('is shown as one, with the way to undo it', async () => {
    await fakeBrowser.storage.local.set({ 'tweakpage:transfer-consent': ['demo-bucket'] });
    await openSettings();
    await waitFor(() => expect(screen.getByTestId('forget-consent')).toBeTruthy());
    expect(document.querySelector('.twk-settings-consent')?.textContent).toContain('demo-bucket');
  });

  test('and is not offered before there is anything to undo', async () => {
    // A button offering to ask again about a question nobody has been asked explains
    // nothing, which is exactly how it read.
    await openSettings();
    await waitFor(() => expect(screen.getByTestId('upload-images-all')).toBeTruthy());
    expect(screen.queryByTestId('forget-consent')).toBeNull();
  });
});
