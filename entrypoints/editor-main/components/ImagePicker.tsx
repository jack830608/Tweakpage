import { useRef, useState } from 'react';
import { readImageFile } from '../../../lib/image-file';
import { t } from '../../../lib/i18n';

interface ImagePickerProps {
  ariaLabel: string;
  testId: string;
  onPicked: (dataUrl: string) => void;
}

const REASONS: Record<string, string> = {
  'not-an-image': 'err_not_image',
  'too-large': 'err_image_too_large',
  unreadable: 'err_image_unreadable',
};

/** Picks a local file and hands back a data: URL the applier can store and replay. */
export function ImagePicker({ ariaLabel, testId, onPicked }: ImagePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        data-testid={`${testId}-button`}
        onClick={() => input.current?.click()}
      >
        {t('choose_file')}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label={t('aria_file_input', [ariaLabel])}
        data-testid={testId}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void readImageFile(file).then((result) => {
            if (result.ok) {
              setError(null);
              onPicked(result.dataUrl);
            } else {
              setError(t(REASONS[result.reason]));
            }
          });
        }}
      />
      {error && (
        <p className="pgve-hint" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
