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
import type { ToastContent } from './Toast';
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
  onToast: (toast: ToastContent) => void;
}

const THEME_OPTIONS = [
  { value: 'system', label: t('theme_system'), ariaLabel: t('theme_system') },
  { value: 'light', label: t('theme_light'), ariaLabel: t('theme_light') },
  { value: 'dark', label: t('theme_dark'), ariaLabel: t('theme_dark') },
] as const;

export function SettingsView({ prefs, onPrefs, onToast }: SettingsViewProps) {
  const [appearanceOpen, setAppearanceOpen] = useState(true);

  return (
    <div className="twk-settings">
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
      <ImagesGroup onToast={onToast} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="twk-setting">
      <span className="twk-setting-label">{label}</span>
      <div className="twk-setting-control">{children}</div>
    </div>
  );
}

function ShareGroup({ onToast }: { onToast: (toast: ToastContent) => void }) {
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
          className={ready ? 'twk-chip twk-chip-on' : 'twk-chip'}
          data-testid="share-status"
        >
          {ready ? t('settings_share_on') : t('settings_share_off')}
        </span>
      }
    >
      <p className="twk-settings-note">{t('settings_sharing_hint')}</p>
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
      <div className="twk-settings-actions">
        <button
          type="button"
          aria-label={t('opt_clear')}
          data-testid="clear-share-settings"
          onClick={() => {
            commit(EMPTY_SETTINGS);
            onToast({ message: t('toast_share_cleared'), kind: 'info' });
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
 * What happens to a picked image when a link is made.
 *
 * Uploading is what makes a share work at all — an embedded image is too big to survive
 * the import limits, so without it the recipient quietly sees the original picture.
 * Compression is a separate decision because it sends the image to a third party.
 */
function ImagesGroup({ onToast }: { onToast: (toast: ToastContent) => void }) {
  const [settings, setSettings] = useState<ShareSettings | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void getShareSettings().then(setSettings);
  }, []);
  if (!settings) return null;

  const commit = (next: ShareSettings) => {
    setSettings(next);
    void saveShareSettings(next);
  };

  return (
    <CollapsibleSection
      title={t('settings_images')}
      sectionId="set-images"
      open={open}
      onToggle={() => setOpen((current) => !current)}
    >
      <Row label={t('settings_upload_images')}>
        <Switch
          ariaLabel={t('aria_upload_images')}
          testId="upload-images"
          checked={settings.uploadImages}
          onChange={(uploadImages) => commit({ ...settings, uploadImages })}
        />
      </Row>
      <p className="twk-settings-note">{t('settings_upload_images_hint')}</p>

      <Row label="TINYPNG_API_KEY">
        <input
          type="password"
          aria-label="TINYPNG_API_KEY"
          data-testid="setting-tinypngKey"
          autoComplete="off"
          spellCheck={false}
          value={settings.tinypngKey}
          onChange={(e) => commit({ ...settings, tinypngKey: e.target.value })}
        />
      </Row>
      <Row label={t('settings_compress')}>
        <Switch
          ariaLabel={t('aria_compress_images')}
          testId="compress-images"
          checked={settings.compressImages && settings.tinypngKey !== ''}
          disabled={settings.tinypngKey === ''}
          onChange={(compressImages) => commit({ ...settings, compressImages })}
        />
      </Row>
      <p className="twk-settings-note">{t('settings_compress_hint')}</p>
    </CollapsibleSection>
  );
}

function Switch({
  ariaLabel,
  testId,
  checked,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  testId: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={disabled ? 'twk-switch twk-switch--off' : 'twk-switch'}>
      <input
        type="checkbox"
        aria-label={ariaLabel}
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{checked ? t('on') : t('off')}</span>
    </label>
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
  onToast: (toast: ToastContent) => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(POLICY);
      onToast({ message: t('toast_policy_copied'), kind: 'success' });
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
      <p className="twk-settings-note">{t('settings_permissions_body')}</p>
      <pre className="twk-policy">{POLICY}</pre>
      <div className="twk-settings-actions">
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
