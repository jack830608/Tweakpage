import { t } from '../../../lib/i18n';

export function OnboardingCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="pgve-onboarding">
      <h3>{t('onboarding_title')}</h3>
      <ol>
        <li>{t('onboarding_step1')}</li>
        <li>{t('onboarding_step2')}</li>
        <li>{t('onboarding_step3')}</li>
      </ol>
      <p className="pgve-onboarding-safety">{t('onboarding_step4')}</p>
      <button type="button" onClick={onDismiss}>{t('got_it')}</button>
    </div>
  );
}
