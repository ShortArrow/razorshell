import { useEffect, useState } from 'react';
import { saveUrl, showUrls } from '../urllist';

export function UrlApp() {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const fetchUrls = async () => {
      setUrls(await showUrls());
    };
    fetchUrls();
  }, []);

  return <>
    <div className='flex flex-col'>
      <h2 className='h2'>URL list</h2>
      <div>
        {
          urls.map((url, index) => {
            return <div key={index}>{url}</div>;
          })
        }
      </div>
      <label className='input input-bordered flex p-0'>
        <input type="url" id="url" className='grow' />
        <button className='btn btn-neutral' onClick={() => {
          const url = (document.getElementById('url') as HTMLInputElement).value;
          saveUrl([url]);
          setUrls([...urls, url]);
        }}>add url</button>
      </label>
    </div>
  </>;
}