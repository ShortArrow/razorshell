import { useEffect, useState } from 'react';
import { loadContentEditableSetting, saveContentEditableSetting } from '../contenteditablesetting';
import { getMessage } from '../languages';

export function RichTextApp() {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    const fetchSetting = async () => {
      setEnabled(await loadContentEditableSetting());
    };
    fetchSetting();
  }, []);

  const apply = (value: boolean) => {
    setEnabled(value);
    saveContentEditableSetting(value);
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
          <span className='label-text'>{getMessage('richtext_label')()}</span>
        </label>
      </div>
    </div>
  </>;
}
