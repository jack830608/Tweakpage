import { useEffect, useState } from 'react';
import { isBucketName, isRegionName } from '../../lib/share/link';
import {
  EMPTY_SETTINGS,
  TINYPNG_FIELD,
  getShareSettings,
  isConfigured,
  saveShareSettings,
  SHARE_FIELDS,
  type ShareSettings,
} from '../../lib/share/settings';
import { ConfirmButton } from '../editor-main/components/ConfirmButton';
import { t } from '../../lib/i18n';

/** The five values this page owns. Everything else in the object belongs to the panel. */
const CREDENTIALS_ONLY = {
  bucket: '',
  region: '',
  accessKeyId: '',
  secretAccessKey: '',
  tinypngKey: '',
} as const;

/**
 * What is wrong with this one value, if anything.
 *
 * The page used to have a single line for every kind of wrong — "fill all four fields" —
 * so somebody who pasted "Asia Pacific (Tokyo)" out of the AWS console had all four
 * filled and was told to fill them. A wrong value and a missing one are different
 * problems and only one of them is about the field being empty.
 */
function problemWith(key: string, value: string): string | null {
  if (value.trim() === '') return null;
  if (key === 'bucket' && !isBucketName(value)) return t('err_bucket');
  if (key === 'region' && !isRegionName(value)) return t('err_region');
  return null;
}

export function OptionsApp() {
  const [settings, setSettings] = useState<ShareSettings>(EMPTY_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void getShareSettings().then(setSettings);
  }, []);

  const empty = [...SHARE_FIELDS].filter((f) => settings[f.key].trim() === '').length;

  return (
    <main className="opt">
      <h1>{t('opt_title')}</h1>
      <p className="opt-intro">{t('opt_intro')}</p>

      {/* Numbered, because it is a sequence and every step of it happens somewhere else.
          The page used to open with two sentences and an IAM policy, and ask for four
          AWS values as though the reader already had them. */}
      <ol className="opt-steps">
        <li>
          <h2>{t('opt_step1_title')}</h2>
          <p>{t('opt_step1_body')}</p>
          <a className="opt-link" href="https://s3.console.aws.amazon.com/s3/buckets" target="_blank" rel="noreferrer">
            {t('opt_step1_link')}
          </a>
        </li>
        <li>
          <h2>{t('opt_step2_title')}</h2>
          <p>{t('opt_step2_body')}</p>
          <a className="opt-link" href="https://console.aws.amazon.com/iam/home#/users" target="_blank" rel="noreferrer">
            {t('opt_step2_link')}
          </a>
          <details className="opt-policy">
            <summary>{t('opt_policy_show')}</summary>
            <pre>{POLICY}</pre>
            <button
              type="button"
              className="opt-copy"
              data-testid="copy-policy"
              onClick={() => void navigator.clipboard?.writeText(POLICY)}
            >
              {t('opt_policy_copy')}
            </button>
          </details>
        </li>
        <li>
          <h2>{t('opt_step3_title')}</h2>
          <p>{t('opt_step3_body')}</p>
        </li>
      </ol>

      <div className="opt-warning" role="note">
        <strong>{t('opt_risk_title')}</strong>
        <p>{t('opt_risk_body')}</p>
      </div>

      <form
        className="opt-form"
        onSubmit={(e) => {
          e.preventDefault();
          void saveShareSettings(settings).then(() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          });
        }}
      >
        {[...SHARE_FIELDS, TINYPNG_FIELD].map(({ key, label, env, secret, hint }) => {
          const problem = touched[key] ? problemWith(key, settings[key]) : null;
          return (
            <label key={key}>
              <span>
                {label} <code>{env}</code>
              </span>
              <div className="opt-input">
                <input
                  type={secret && !shown[key] ? 'password' : 'text'}
                  aria-label={label}
                  data-testid={key}
                  // A field with no placeholder beside three that have one reads as
                  // disabled, which is how both secrets looked.
                  placeholder={hint ?? (secret ? '••••••••••••' : undefined)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={problem ? true : undefined}
                  value={settings[key]}
                  onBlur={() => setTouched((was) => ({ ...was, [key]: true }))}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                />
                {secret && (
                  <button
                    type="button"
                    className="opt-reveal"
                    data-testid={`show-${key}`}
                    aria-label={t(shown[key] ? 'opt_hide' : 'opt_show')}
                    onClick={() => setShown((was) => ({ ...was, [key]: !was[key] }))}
                  >
                    {t(shown[key] ? 'opt_hide' : 'opt_show')}
                  </button>
                )}
              </div>
              {problem && (
                <span className="opt-problem" data-testid={`problem-${key}`}>
                  {problem}
                </span>
              )}
            </label>
          );
        })}
        <div className="opt-actions">
          <button type="submit" data-testid="save-settings">{t('opt_save')}</button>
          {/* Two steps, and only the keys. One click used to throw away a secret AWS
              will never show again — while clearing a single page's edits, which you can
              simply make again, asked twice. It also wrote the whole settings object, so
              it silently reset the upload switches set over in the panel. */}
          <ConfirmButton
            label={t('opt_clear')}
            ariaLabel={t('opt_clear')}
            confirmLabel={t('opt_clear_confirm')}
            className="opt-clear"
            testId="clear-settings"
            onConfirm={() => {
              const cleared = { ...settings, ...CREDENTIALS_ONLY };
              setSettings(cleared);
              void saveShareSettings(cleared);
            }}
          />
          {saved && <span className="opt-saved">{t('saved_just_now')}</span>}
          {!isConfigured(settings) && (
            <span className="opt-status" data-testid="opt-status">
              {empty > 0 ? t('opt_incomplete') : t('opt_check_values')}
            </span>
          )}
        </div>
      </form>
    </main>
  );
}

/** Shown so the bucket can be set up before a key is pasted, not after something fails. */
const POLICY = `// The key you paste below, on the bucket's own policy or its IAM user:
{ "Effect": "Allow", "Action": ["s3:PutObject", "s3:PutObjectAcl"],
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }

// Plus one of these, so a link opens for someone with no AWS account —
// either a public-read policy on the bucket:
{ "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }

// or leave ACLs enabled and Block Public Access off for this bucket, and
// Tweakpage will mark each file public as it uploads.`;
