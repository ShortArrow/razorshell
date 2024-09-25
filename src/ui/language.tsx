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
    <div className="">
      <h2 className="">Language</h2>
      <p>detect language of browser setting</p>
      <h3>Accept-Language</h3>
      <div className="flex gap-3">
        {
          acceptLanguages.map((lang, index) => {
            return <p className="badge" key={index}>{lang}</p>;
          })
        }
      </div>
      <h3>UI Language</h3>
      <p className="badge">{uiLanguage}</p>
    </div >
  );
}