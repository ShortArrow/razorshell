import { useEffect, useState } from 'react';
import { saveUrl, showUrls } from './urllist';

function App() {
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

      </div>
    </>
  );
}

export default App;
