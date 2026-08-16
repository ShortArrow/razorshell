import { useEffect, useState } from 'react';
import {
  loadContentEditableSetting,
  saveContentEditableSetting,
  subscribeContentEditableSetting,
} from '../contenteditablesetting';
import { getMessage } from '../languages';

export function RichTextApp() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  useEffect(() => {
    const fetchSetting = async () => {
      setEnabled(await loadContentEditableSetting());
    };
    void fetchSetting();
    return subscribeContentEditableSetting(setEnabled);
  }, []);

  const apply = (value: boolean) => {
    setEnabled(value);
    saveContentEditableSetting(value)
      .then(() => setSaveError(''))
      .catch(async (failure: unknown) => {
        setSaveError(failure instanceof Error ? failure.message : String(failure));
        // The checkbox showed `value` optimistically. Storage refused it, so
        // reading the setting back is what makes the two agree again.
        setEnabled(await loadContentEditableSetting());
      });
  };

  return <>
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>Rich text editors</h2>
      <div className='tooltip tooltip-top w-fit' data-tip={getMessage('tooltip_richtext')()}>
        <label className='label cursor-pointer gap-3'>
          <input
            type='checkbox'
            data-testid='richtext-toggle'
            className='toggle toggle-primary checked:[--tglbg:color-mix(in_oklab,oklch(var(--p)/1)_25%,oklch(var(--b1)/1))]'
            checked={enabled}
            onChange={(e) => apply(e.target.checked)}
          />
          <span className='label-text'>Enable in rich text editors</span>
        </label>
      </div>
      <div className='min-h-6' data-testid='richtext-save-error'>
        {saveError === '' ? null : <span className='text-error'>{saveError}</span>}
      </div>
    </div>
  </>;
}
