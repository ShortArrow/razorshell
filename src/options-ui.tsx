import { useEffect, useState } from 'react';
import { saveUrl, showUrls } from './urllist';
import { LangApp } from './ui/language';

function OptionsUI() {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const fetchUrls = async () => {
      setUrls(await showUrls());
    };
    fetchUrls();
  }, []);

  return (
    <>
      <div>
        <div>
          {
            urls.map((url, index) => {
              return <div key={index}>{url}</div>;
            })
          }
        </div>
        <div>
          <input type="text" id="url" />
          <button onClick={() => {
            const url = (document.getElementById('url') as HTMLInputElement).value;
            saveUrl([url]);
            setUrls([...urls, url]);
          }}>add url</button>
        </div>
        <LangApp />
      </div>
    </>
  );
}

export default OptionsUI;
