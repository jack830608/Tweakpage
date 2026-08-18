import { useEffect, useState } from 'react';
import {
  EMPTY_SETTINGS,
  TINYPNG_FIELD,
  getShareSettings,
  isConfigured,
  saveShareSettings,
  SHARE_FIELDS,
  type ShareSettings,
} from '../../lib/share/settings';
import { t } from '../../lib/i18n';

export function OptionsApp() {
  const [settings, setSettings] = useState<ShareSettings>(EMPTY_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getShareSettings().then(setSettings);
  }, []);

  return (
    <main className="opt">
      <h1>{t('opt_title')}</h1>
      <p className="opt-intro">{t('opt_intro')}</p>

      <div className="opt-warning" role="note">
        <strong>{t('opt_risk_title')}</strong>
        <p>{t('opt_risk_body')}</p>
        <pre>{POLICY}</pre>
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
        {[...SHARE_FIELDS, TINYPNG_FIELD].map(({ key, label, env, secret, hint }) => (
          <label key={key}>
            <span>
              {label} <code>{env}</code>
            </span>
            <input
              type={secret ? 'password' : 'text'}
              aria-label={label}
              data-testid={key}
              placeholder={hint}
              autoComplete="off"
              spellCheck={false}
              value={settings[key]}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
            />
          </label>
        ))}
        <div className="opt-actions">
          <button type="submit" data-testid="save-settings">{t('opt_save')}</button>
          <button
            type="button"
            className="opt-clear"
            data-testid="clear-settings"
            onClick={() => {
              setSettings(EMPTY_SETTINGS);
              void saveShareSettings(EMPTY_SETTINGS);
            }}
          >
            {t('opt_clear')}
          </button>
          {saved && <span className="opt-saved">{t('saved_just_now')}</span>}
          {!isConfigured(settings) && <span className="opt-status">{t('opt_incomplete')}</span>}
        </div>
      </form>
    </main>
  );
}

/** Shown so the bucket can be set up before a key is pasted, not after something fails. */
const POLICY = `// The key you paste above, on the bucket's own policy or its IAM user:
{ "Effect": "Allow", "Action": ["s3:PutObject", "s3:PutObjectAcl"],
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }

// Plus one of these, so a link opens for someone with no AWS account —
// either a public-read policy on the bucket:
{ "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }

// or leave ACLs enabled and Block Public Access off for this bucket, and
// Tweakpage will mark each file public as it uploads.`;
