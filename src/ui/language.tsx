import { useEffect, useState } from "react";
import { availableLocales, normalizeLocale } from "../i18n";
import {
  getAcceptLanguage,
  getLanguageSetting,
  getMessage,
  getUILanguage,
  setLanguage,
} from "../languages";

const autoLanguage = "auto";

function effectiveLanguage(setting: string, uiLanguage: string): string {
  const locale = normalizeLocale(setting);
  return locale ?? `browser (auto): ${uiLanguage}`;
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
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>Language</h2>
      <p>detect language of browser setting</p>
      <div className='flex items-center gap-2'>
        <label htmlFor='language-select'>Display language of this options page</label>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_language_select')()}>
          <select
            id='language-select'
            data-testid='language-select'
            className='select select-bordered select-sm'
            value={setting}
            onChange={(e) => applyLanguage(e.target.value)}
          >
            <option value={autoLanguage}>{autoLanguage}</option>
            {availableLocales.map((locale) => <option key={locale} value={locale}>{locale}</option>)}
          </select>
        </div>
      </div>
      <p>
        <span>effective language: </span>
        <span className='badge badge-primary' data-testid='effective-language'>
          {effectiveLanguage(setting, uiLanguage)}
        </span>
      </p>
      <h3>Accept-Language</h3>
      <div className='flex gap-3'>
        {
          acceptLanguages.map((lang, index) => {
            return <p className='badge' key={index}>{lang}</p>;
          })
        }
      </div>
      <h3>UI Language</h3>
      <p className='badge'>{uiLanguage}</p>
    </div>
  );
}
