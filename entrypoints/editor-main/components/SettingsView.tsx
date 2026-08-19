import { useEffect, useRef, useState, type ReactNode } from 'react';
import { safeSendMessage } from '../../../lib/extension-context';
import { getExclusions, ruleProblem, saveExclusions, type RuleProblem } from '../../../lib/exclusions';
import { hasConsented, withdrawConsent } from '../../../lib/share/consent';
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
import { plural, t } from '../../../lib/i18n';

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

export function SettingsView({ prefs, onPrefs, onToast }: SettingsViewProps) {
  const [appearanceOpen, setAppearanceOpen] = useState(true);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  useEffect(() => {
    void getShareStatus().then(setStatus);
  }, []);

  const commit = (next: ShareStatus) => {
    setStatus(next);
    void saveSharePreferences({
      uploadImages: next.uploadImages,
      compressImages: next.compressImages,
    });
  };

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
      <ExclusionsGroup onToast={onToast} />
      {status && <SharingGroup status={status} />}
      {status && <ImagesGroup status={status} onChange={commit} onToast={onToast} />}
    </div>
  );
}

/**
 * Written as a switch of literal t() calls rather than a lookup table: the translation
 * guard finds keys by scanning for t('...'), so a table would take these out of its
 * sight and let one go missing from a locale unnoticed.
 */
function problemMessage(problem: RuleProblem): string {
  switch (problem) {
    case 'empty':
      return t('exclude_empty');
    case 'too long':
      return t('exclude_too_long');
    case 'not a selector':
      return t('exclude_not_a_selector');
    case 'catches everything':
      return t('exclude_catches_everything');
    case 'already there':
      return t('exclude_already_there');
  }
}

/**
 * Parts of the page the picker will not offer. Not protection — this all runs on your
 * own copy of the page — but an edit on a chat launcher or a consent banner reproduces
 * for nobody, and the engineer receiving it gets a line they cannot act on.
 */
function ExclusionsGroup({ onToast }: { onToast: (toast: ToastContent) => void }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    void getExclusions().then(setRules);
  }, []);

  const commit = (next: string[]) => {
    setRules(next);
    void saveExclusions(next);
  };
  const add = () => {
    const rule = draft.trim();
    const problem = ruleProblem(rule, rules);
    if (problem) {
      onToast({ message: problemMessage(problem), kind: 'error' });
      return;
    }
    commit([...rules, rule]);
    setDraft('');
  };

  return (
    <CollapsibleSection
      title={t('settings_exclusions')}
      sectionId="set-exclusions"
      open={open}
      onToggle={() => setOpen((current) => !current)}
      aside={
        <span className="twk-chip" data-testid="exclusion-count">
          {plural(rules.length, 'settings_exclusions_count_one', 'settings_exclusions_count')}
        </span>
      }
    >
      <p className="twk-settings-note">{t('settings_exclusions_hint')}</p>
      {rules.length === 0 ? (
        <p className="twk-settings-note twk-settings-note--tight">{t('settings_exclusions_empty')}</p>
      ) : (
        <ul className="twk-rules" data-testid="exclusion-list">
          {rules.map((rule, i) => (
            <li key={rule} className="twk-rule">
              <code>{rule}</code>
              <button
                type="button"
                aria-label={t('aria_exclusion_remove', [rule])}
                data-testid={`remove-exclusion-${i}`}
                onClick={() => commit(rules.filter((r) => r !== rule))}
              >
                {'\u00d7'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="twk-setting">
        <span className="twk-setting-label">{t('settings_exclusion_add')}</span>
        <div className="twk-setting-control twk-rule-add">
          <input
            type="text"
            aria-label={t('aria_exclusion_input')}
            data-testid="exclusion-input"
            placeholder=".chat-widget"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              add();
            }}
          />
          <button type="button" data-testid="add-exclusion" onClick={add}>
            {t('settings_exclusion_add_button')}
          </button>
        </div>
      </div>
    </CollapsibleSection>
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

/**
 * Two groups, because they answer two different questions: whether sharing can work at
 * all, and what happens to pictures on the way out.
 */
function SharingGroup({ status }: { status: ShareStatus }) {
  const [open, setOpen] = useState(!status.configured);
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
    </CollapsibleSection>
  );
}

function ImagesGroup({
  status,
  onChange,
  onToast,
}: {
  status: ShareStatus;
  onChange: (next: ShareStatus) => void;
  onToast: (toast: ToastContent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [allowedFor, setAllowedFor] = useState<string | null>(null);
  useEffect(() => {
    void hasConsented(status.bucket).then((yes) => setAllowedFor(yes ? status.bucket : null));
  }, [status.bucket]);

  const on = HAND_OFFS.filter((k) => status.uploadImages[k]).length;
  const setAll = (value: boolean) =>
    onChange({
      ...status,
      uploadImages: Object.fromEntries(HAND_OFFS.map((k) => [k, value])) as ShareStatus['uploadImages'],
    });

  return (
    <CollapsibleSection
      title={t('settings_images')}
      sectionId="set-images"
      open={open}
      onToggle={() => setOpen((current) => !current)}
      aside={
        <span className="twk-chip" data-testid="upload-count">
          {t('settings_upload_count', [String(on), String(HAND_OFFS.length)])}
        </span>
      }
    >
      <p className="twk-settings-note">{t('settings_upload_images_hint')}</p>

      {/* The one that governs the others sits above them, inside the same box and
          separated by a rule — a plain checkbox in a row of checkboxes gives no clue
          that unticking it unticks four more. */}
      <div className="twk-switch-set">
        <label className="twk-switch twk-switch--all">
          <input
            type="checkbox"
            aria-label={t('aria_upload_images_all')}
            data-testid="upload-images-all"
            ref={(box) => {
              if (box) box.indeterminate = on > 0 && on < HAND_OFFS.length;
            }}
            checked={on === HAND_OFFS.length}
            onChange={(e) => setAll(e.target.checked)}
          />
          <span>{t('settings_upload_all')}</span>
        </label>
        <div className="twk-switch-grid">
          {HAND_OFFS.map((handOff) => (
            <Switch
              key={handOff}
              label={t(`hand_off_${handOff}`)}
              ariaLabel={t('aria_upload_images', [t(`hand_off_${handOff}`)])}
              testId={`upload-images-${handOff}`}
              checked={status.uploadImages[handOff]}
              onChange={(value) =>
                onChange({ ...status, uploadImages: { ...status.uploadImages, [handOff]: value } })
              }
            />
          ))}
        </div>
      </div>

      <Switch
        label={t('settings_compress')}
        ariaLabel={t('aria_compress_images')}
        testId="compress-images"
        checked={status.compressImages && status.compressionAvailable}
        disabled={!status.compressionAvailable}
        onChange={(compressImages) => onChange({ ...status, compressImages })}
      />
      <p className="twk-settings-note twk-settings-note--tight">
        {status.compressionAvailable ? t('settings_compress_hint') : t('settings_compress_needs_key')}
      </p>

      {/* Shown only once there is something to withdraw. A button offering to ask again
          about a question nobody has been asked yet explains nothing. */}
      {allowedFor && (
        <div className="twk-settings-consent">
          <span>{t('settings_consent_given', [allowedFor])}</span>
          <button
            type="button"
            aria-label={t('aria_forget_consent')}
            data-testid="forget-consent"
            onClick={() => {
              void withdrawConsent();
              setAllowedFor(null);
              onToast({ message: t('toast_consent_withdrawn'), kind: 'info' });
            }}
          >
            {t('settings_withdraw')}
          </button>
        </div>
      )}
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
