import { useEffect, useState } from "react";
import { availableLocales, normalizeLocale } from "../i18n";
import {
  getAcceptLanguage,
  getLanguageSetting,
  getMessage,
  getUILanguage,
  setLanguage,
} from "../languages";
import { Select } from "./select";

const autoLanguage = "auto";

function effectiveLanguage(setting: string, uiLanguage: string): string {
  const locale = normalizeLocale(setting);
  return locale ?? `auto (${uiLanguage})`;
}

export function LangApp() {
  const [uiLanguage, setUiLanguage] = useState<string>('');
  const [acceptLanguages, setAcceptLanguages] = useState<string[]>([]);
  const [setting, setSetting] = useState<string>(autoLanguage);
  const [saveError, setSaveError] = useState<string>('');

  useEffect(() => {
    const fetchLanguages = async () => {
      setAcceptLanguages(await getAcceptLanguage());
      setUiLanguage(getUILanguage());
      setSetting(await getLanguageSetting());
    };
    fetchLanguages();
  }, []);

  const applyLanguage = (value: string) => {
    setSetting(value);
    setLanguage(value)
      .then(() => setSaveError(''))
      .catch(async (failure: unknown) => {
        setSaveError(failure instanceof Error ? failure.message : String(failure));
        // The select and badge showed `value` optimistically. Storage refused
        // it, so reading the setting back is what makes the two agree again.
        setSetting(await getLanguageSetting());
      });
  };

  return (
    <div className='flex flex-col w-full gap-2'>
      <h2 className='h2'>Language</h2>
      <div className='flex items-center gap-2'>
        <label htmlFor='language-select'>Display language of this options page</label>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_language_select')()}>
          <Select
            id='language-select'
            data-testid='language-select'
            className='select-sm'
            value={setting}
            onChange={(e) => applyLanguage(e.target.value)}
          >
            <option value={autoLanguage}>{autoLanguage}</option>
            {availableLocales.map((locale) => <option key={locale} value={locale}>{locale}</option>)}
          </Select>
        </div>
        <span className='badge badge-primary whitespace-nowrap' data-testid='effective-language'>
          {effectiveLanguage(setting, uiLanguage)}
        </span>
      </div>
      <div className='flex items-center gap-2 text-sm opacity-80'>
        <span>browser UI:</span>
        <span className='badge badge-sm badge-ghost'>{uiLanguage}</span>
        <span>accept:</span>
        {acceptLanguages.map((lang, index) => (
          <span className='badge badge-sm badge-ghost' key={index}>{lang}</span>
        ))}
      </div>
      <div className='min-h-6' data-testid='language-save-error'>
        {saveError === '' ? null : <span className='text-error'>{saveError}</span>}
      </div>
    </div>
  );
}
