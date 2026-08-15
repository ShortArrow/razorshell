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
    setLanguage(value);
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
    </div>
  );
}
