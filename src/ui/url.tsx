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
    <div className='flex flex-col w-full'>
      <h2 className='h2'>URL list</h2>
      <div className='join w-full'>
        <label className='input input-bordered join-item flex justify-center items-center grow'>
          <input type="url" id="url" className='grow' />
        </label>
        <button className='btn btn-neutral join-item' onClick={() => {
          const url = (document.getElementById('url') as HTMLInputElement).value;
          saveUrl([url]);
          setUrls([...urls, url]);
        }}>add url</button>
      </div>
      <div>
        <ul>
          {
            urls.map((url, index) => {
              if (url === '') return null;
              return <li key={index}>
                <a href={url}>{url}</a>
              </li>;
            })
          }
        </ul>
      </div>
    </div>
  </>;
}