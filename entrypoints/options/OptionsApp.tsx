import { useEffect, useState } from 'react';
import {
  EMPTY_SETTINGS,
  getShareSettings,
  isConfigured,
  saveShareSettings,
  type ShareSettings,
} from '../../lib/share/settings';
import { t } from '../../lib/i18n';

const FIELDS: Array<{ key: keyof ShareSettings; label: string; secret?: boolean; hint?: string }> = [
  { key: 'bucket', label: 'AWS_S3_BUCKET' },
  { key: 'region', label: 'AWS_REGION', hint: 'ap-northeast-1' },
  { key: 'accessKeyId', label: 'AWS_ACCESS_KEY_ID' },
  { key: 'secretAccessKey', label: 'AWS_SECRET_ACCESS_KEY', secret: true },
];

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
        {FIELDS.map(({ key, label, secret, hint }) => (
          <label key={key}>
            <span>{label}</span>
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
const POLICY = `// The key you paste above only needs to write:
{ "Effect": "Allow", "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }

// And the bucket lets anyone read a share, so a link works without an AWS account:
{ "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }`;
