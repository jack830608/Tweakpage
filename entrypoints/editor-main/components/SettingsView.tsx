import { useEffect, useState, type ReactNode } from 'react';
import {
  EMPTY_SETTINGS,
  getShareSettings,
  isConfigured,
  saveShareSettings,
  SHARE_FIELDS,
  type ShareSettings,
} from '../../../lib/share/settings';
import type { PanelPrefs, ThemeChoice } from '../panel-position';
import { CollapsibleSection } from './CollapsibleSection';
import { ModeSwitch } from './ModeSwitch';
import { t } from '../../../lib/i18n';

/**
 * Settings, where the work is.
 *
 * They used to live only behind a right-click on the toolbar icon, which is a place
 * nobody finds while editing a page.
 *
 * The shape is deliberately plain: collapsible groups of rows, each row a label over one
 * full-width control. A new setting is a new row, not a new layout. Groups collapse
 * because a settings screen is read one concern at a time — sharing is four credentials
 * you set once, and it should not be four fields you scroll past forever after.
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
  const [appearanceOpen, setAppearanceOpen] = useState(true);

  return (
    <div className="pgve-settings">
      <CollapsibleSection
        title={t('settings_appearance')}
        sectionId="set-appearance"
        open={appearanceOpen}
        onToggle={() => setAppearanceOpen((current) => !current)}
      >
        <Row label={t('settings_theme')}>
          <ModeSwitch<ThemeChoice>
            ariaLabel={t('aria_theme')}
            options={THEME_OPTIONS}
            value={prefs.theme}
            onChange={(theme) => onPrefs({ ...prefs, theme })}
          />
        </Row>
      </CollapsibleSection>
      <ShareGroup onToast={onToast} />
    </div>
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
  const [settings, setSettings] = useState<ShareSettings | null>(null);
  // Decided once, when the stored settings arrive — a default computed during render
  // cannot be turned off, because the click that should close it has nothing to write to.
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    void getShareSettings().then((stored) => {
      setSettings(stored);
      // Open where there is something to do: nothing filled in means this is why you came.
      setOpen(!isConfigured(stored));
    });
  }, []);

  const ready = settings !== null && isConfigured(settings);
  const commit = (next: ShareSettings) => {
    setSettings(next);
    void saveShareSettings(next);
  };

  return (
    <CollapsibleSection
      title={t('settings_sharing')}
      sectionId="set-sharing"
      open={open}
      onToggle={() => setOpen((current) => !current)}
      aside={
        <span
          className={ready ? 'pgve-chip pgve-chip-on' : 'pgve-chip'}
          data-testid="share-status"
        >
          {ready ? t('settings_share_on') : t('settings_share_off')}
        </span>
      }
    >
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
            value={settings?.[key] ?? ''}
            // Saved as you type: there is no submit button to miss, and a half-typed
            // bucket name simply leaves sharing switched off until it is whole.
            onChange={(e) => commit({ ...(settings ?? EMPTY_SETTINGS), [key]: e.target.value })}
          />
        </Row>
      ))}
      <div className="pgve-settings-actions">
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
      <PermissionsHelp open={helpOpen} onToggle={() => setHelpOpen((current) => !current)} onToast={onToast} />
    </CollapsibleSection>
  );
}

/**
 * The bucket policy, here rather than a page away.
 *
 * These are the two things AWS has to be told before a link will open, and they are
 * needed exactly while the fields above are being filled in — sending someone to another
 * screen to read them is the reason this used to be a link.
 */
function PermissionsHelp({
  open,
  onToggle,
  onToast,
}: {
  open: boolean;
  onToggle: () => void;
  onToast: (toast: { message: string }) => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(POLICY);
      onToast({ message: t('toast_policy_copied') });
    } catch {
      window.prompt('Copy the text below:', POLICY);
    }
  };

  return (
    <CollapsibleSection
      title={t('settings_permissions')}
      sectionId="set-permissions"
      open={open}
      onToggle={onToggle}
    >
      <p className="pgve-settings-note">{t('settings_permissions_body')}</p>
      <pre className="pgve-policy">{POLICY}</pre>
      <div className="pgve-settings-actions">
        <button type="button" aria-label={t('copy_policy')} data-testid="copy-policy" onClick={() => void copy()}>
          {t('copy_policy')}
        </button>
      </div>
    </CollapsibleSection>
  );
}

const POLICY = `// the key above may write, and mark what it writes readable:
{ "Effect": "Allow", "Action": ["s3:PutObject", "s3:PutObjectAcl"],
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }

// and a stranger with the link may read it — either this bucket policy:
{ "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }

// or leave ACLs on with Block Public Access off, and each file is
// marked public as it uploads.`;
