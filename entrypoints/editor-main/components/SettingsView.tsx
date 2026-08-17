import { useEffect, useState, type ReactNode } from 'react';
import { safeSendMessage } from '../../../lib/extension-context';
import {
  EMPTY_SETTINGS,
  getShareSettings,
  isConfigured,
  saveShareSettings,
  SHARE_FIELDS,
  type ShareSettings,
} from '../../../lib/share/settings';
import type { PanelPrefs, ThemeChoice } from '../panel-position';
import { ModeSwitch } from './ModeSwitch';
import { t } from '../../../lib/i18n';

/**
 * Settings, where the work is.
 *
 * They used to live only behind a right-click on the toolbar icon, which is a place
 * nobody finds while editing a page. The options page still exists — Chrome expects one,
 * and the bucket policy is easier to copy from a full-width page — but everything you
 * can change is reachable from the panel itself.
 *
 * The shape is deliberately plain: groups of rows, each row a label and one control.
 * A new setting is a new row, not a new layout.
 */
interface SettingsViewProps {
  prefs: PanelPrefs;
  onPrefs: (next: PanelPrefs) => void;
  onToast: (toast: { message: string }) => void;
}

const THEME_OPTIONS = [
  { value: 'system', label: t('theme_system'), ariaLabel: t('theme_system') },
  { value: 'light', label: t('theme_light'), ariaLabel: t('theme_light') },
  { value: 'dark', label: t('theme_dark'), ariaLabel: t('theme_dark') },
] as const;

export function SettingsView({ prefs, onPrefs, onToast }: SettingsViewProps) {
  return (
    <div className="pgve-settings">
      <Group title={t('settings_appearance')}>
        <Row label={t('settings_theme')}>
          <ModeSwitch<ThemeChoice>
            ariaLabel={t('aria_theme')}
            options={THEME_OPTIONS}
            value={prefs.theme}
            onChange={(theme) => onPrefs({ ...prefs, theme })}
          />
        </Row>
      </Group>
      <ShareGroup onToast={onToast} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pgve-settings-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pgve-setting">
      <span className="pgve-setting-label">{label}</span>
      <div className="pgve-setting-control">{children}</div>
    </div>
  );
}

function ShareGroup({ onToast }: { onToast: (toast: { message: string }) => void }) {
  const [settings, setSettings] = useState<ShareSettings>(EMPTY_SETTINGS);
  useEffect(() => {
    void getShareSettings().then(setSettings);
  }, []);

  const commit = (next: ShareSettings) => {
    setSettings(next);
    void saveShareSettings(next);
  };

  return (
    <Group title={t('settings_sharing')}>
      <p className="pgve-settings-note">{t('settings_sharing_hint')}</p>
      {SHARE_FIELDS.map(({ key, label, secret, hint }) => (
        <Row key={key} label={label}>
          <input
            type={secret ? 'password' : 'text'}
            aria-label={label}
            data-testid={`setting-${key}`}
            placeholder={hint}
            autoComplete="off"
            spellCheck={false}
            value={settings[key]}
            // Saved as you type: there is no submit button to miss, and a half-typed
            // bucket name simply leaves sharing switched off until it is whole.
            onChange={(e) => commit({ ...settings, [key]: e.target.value })}
          />
        </Row>
      ))}
      <div className="pgve-settings-actions">
        <span className="pgve-settings-status" data-testid="share-status">
          {isConfigured(settings) ? t('settings_share_ready') : t('opt_incomplete')}
        </span>
        <button
          type="button"
          aria-label={t('opt_clear')}
          data-testid="clear-share-settings"
          onClick={() => {
            commit(EMPTY_SETTINGS);
            onToast({ message: t('toast_share_cleared') });
          }}
        >
          {t('opt_clear')}
        </button>
      </div>
      <button
        type="button"
        className="pgve-settings-link"
        aria-label={t('aria_bucket_help')}
        data-testid="bucket-help"
        onClick={() => safeSendMessage({ type: 'pg:open-options' })}
      >
        {t('settings_bucket_help')}
      </button>
    </Group>
  );
}
