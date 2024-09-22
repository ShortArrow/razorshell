import { useEffect, useState } from "react";
import { getAcceptLanguage, getUILanguage } from "../languages";

export function LangApp() {
  const [uiLanguage, setUiLanguage] = useState<string>('');
  const [acceptLanguages, setAcceptLanguages] = useState<string[]>([]);
  useEffect(() => {
    const fetchLanguages = async () => {
      setAcceptLanguages(await getAcceptLanguage());
      setUiLanguage(getUILanguage());
    };
    fetchLanguages();
    return () => {
    };
  }, []);
  return (
    <div>
      <h2>Language</h2>
      <p>detect language of browser setting</p>
      <div>
        <h3>Accept-Language</h3>
        {
          acceptLanguages.map((lang, index) => {
            return <p key={index}>{lang}</p>;
          })
        }
        <h3>UI Language</h3>
        <p>{uiLanguage}</p>

      </div>
    </div>
  );
}