import { t } from '../../../lib/i18n';

/**
 * What is about to leave this machine, said before it does.
 *
 * Everything else Tweakpage does happens in the browser, so the one moment worth
 * interrupting is the first upload: a button called Copy summary does not look like a
 * picture becoming a publicly readable object in a bucket. Four sentences, each about
 * something that stays true afterwards — where it goes, who can read it, what changes
 * here, and who else sees it if compression is on.
 */
interface TransferConsentProps {
  bucket: string;
  images: number;
  compressing: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

export function TransferConsent({
  bucket,
  images,
  compressing,
  onAgree,
  onCancel,
}: TransferConsentProps) {
  return (
    <div className="twk-consent" role="alertdialog" aria-label={t('consent_title')} data-testid="transfer-consent">
      <strong>{t('consent_title')}</strong>
      <ul>
        <li>{t('consent_where', [String(images), bucket])}</li>
        <li>{t('consent_public')}</li>
        <li>{t('consent_local')}</li>
        {compressing && <li>{t('consent_tinify')}</li>}
      </ul>
      <div className="twk-consent-actions">
        <button type="button" data-testid="consent-cancel" onClick={onCancel}>
          {t('consent_cancel')}
        </button>
        <button
          type="button"
          className="twk-consent-agree"
          data-testid="consent-agree"
          onClick={onAgree}
        >
          {t('consent_agree')}
        </button>
      </div>
      <p className="twk-consent-note">{t('consent_revoke')}</p>
    </div>
  );
}
