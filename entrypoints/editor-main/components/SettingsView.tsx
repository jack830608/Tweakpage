import { useEffect, useRef, useState, type ReactNode } from 'react';
import { safeSendMessage } from '../../../lib/extension-context';
import {
  getShareStatus,
  HAND_OFFS,
  saveSharePreferences,
  type ShareStatus,
} from '../../../lib/share/settings';
import type { PanelPrefs, ThemeChoice } from '../panel-position';
import { CollapsibleSection } from './CollapsibleSection';
import { ModeSwitch } from './ModeSwitch';
import type { ToastContent } from './Toast';
import { t } from '../../../lib/i18n';

/**
 * Settings, minus the things a website must never be able to read.
 *
 * This panel is rendered inside the page being edited, which means every value it holds
 * is one `document.getElementById` away from that site's own JavaScript. Shadow DOM is
 * UI encapsulation, not a security boundary. So the AWS and TinyPNG credentials live
 * only on the extension's own options page, and what stands here is their status:
 * enough to know whether sharing will work, worth nothing to steal.
 *
 * The shape is deliberately plain: collapsible groups of rows, each row a label and one
 * control. A new setting is a new row, not a new layout.
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

export function SettingsView({ prefs, onPrefs }: SettingsViewProps) {
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
      <SharingGroup />
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

/** Opens the extension's own page, the only place credentials exist. */
function openSecureSettings(): void {
  safeSendMessage({ type: 'tweakpage:open-options' });
}

function SharingGroup() {
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void getShareStatus().then((next) => {
      setStatus(next);
      // Open where there is something to do: nothing set up means this is why you came.
      setOpen(!next.configured);
    });
  }, []);
  if (!status) return null;

  const commit = (next: ShareStatus) => {
    setStatus(next);
    void saveSharePreferences({
      uploadImages: next.uploadImages,
      compressImages: next.compressImages,
    });
  };

  return (
    <CollapsibleSection
      title={t('settings_sharing')}
      sectionId="set-sharing"
      open={open}
      onToggle={() => setOpen((current) => !current)}
      aside={
        <span
          className={status.configured ? 'twk-chip twk-chip-on' : 'twk-chip'}
          data-testid="share-status"
        >
          {status.configured ? t('settings_share_on') : t('settings_share_off')}
        </span>
      }
    >
      <p className="twk-settings-note">{t('settings_credentials_elsewhere')}</p>
      <div className="twk-settings-actions">
        <button
          type="button"
          aria-label={t('aria_open_secure_settings')}
          data-testid="open-secure-settings"
          onClick={openSecureSettings}
        >
          {t('settings_open_secure')}
        </button>
      </div>

      <p className="twk-settings-note">{t('settings_upload_images_hint')}</p>
      <AllSwitch
        checked={HAND_OFFS.every((k) => status.uploadImages[k])}
        mixed={
          HAND_OFFS.some((k) => status.uploadImages[k]) &&
          !HAND_OFFS.every((k) => status.uploadImages[k])
        }
        onChange={(on) =>
          commit({
            ...status,
            uploadImages: Object.fromEntries(
              HAND_OFFS.map((k) => [k, on]),
            ) as ShareStatus['uploadImages'],
          })
        }
      />
      <div className="twk-switch-grid">
        {HAND_OFFS.map((handOff) => (
          <Switch
            key={handOff}
            label={t(`hand_off_${handOff}`)}
            ariaLabel={t('aria_upload_images', [t(`hand_off_${handOff}`)])}
            testId={`upload-images-${handOff}`}
            checked={status.uploadImages[handOff]}
            onChange={(on) =>
              commit({ ...status, uploadImages: { ...status.uploadImages, [handOff]: on } })
            }
          />
        ))}
      </div>

      <Row label={t('settings_compress')}>
        <Switch
          ariaLabel={t('aria_compress_images')}
          testId="compress-images"
          checked={status.compressImages && status.compressionAvailable}
          disabled={!status.compressionAvailable}
          onChange={(compressImages) => commit({ ...status, compressImages })}
        />
      </Row>
      <p className="twk-settings-note">
        {status.compressionAvailable ? t('settings_compress_hint') : t('settings_compress_needs_key')}
      </p>
    </CollapsibleSection>
  );
}

function Switch({
  label,
  ariaLabel,
  testId,
  checked,
  disabled,
  onChange,
}: {
  /** Shown beside the box. Without one the switch says On or Off about itself. */
  label?: string;
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
      <span>{label ?? (checked ? t('on') : t('off'))}</span>
    </label>
  );
}

/**
 * The one control for all four.
 *
 * Half-on is a real state and the box says so: an indeterminate tick reads as "some",
 * where an unticked box would claim they are all off.
 */
function AllSwitch({
  checked,
  mixed,
  onChange,
}: {
  checked: boolean;
  mixed: boolean;
  onChange: (value: boolean) => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="twk-switch twk-switch--all">
      <input
        ref={box}
        type="checkbox"
        aria-label={t('aria_upload_images_all')}
        data-testid="upload-images-all"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{t('settings_upload_all')}</span>
    </label>
  );
}
