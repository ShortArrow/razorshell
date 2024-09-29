import { useEffect, useState } from 'react';
import { saveUrl, showUrls, removeUrl } from '../urllist';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { urlSchema } from '../validation/url';
import { ZodError } from 'zod';

export function UrlApp() {
  const [urls, setUrls] = useState<string[]>([]);
  const [url, setUrl] = useState<string>('');

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
          <input
            type="url"
            id="url"
            className='grow'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button className='btn btn-primary join-item' onClick={() => {
          try {
            urlSchema.parse(url);
          }
          catch (e: unknown) {
            if (e instanceof ZodError) {
              alert("Invalid URL");
            }
            else {
              console.error(e);
            }
            return;
          }
          saveUrl(url);
          setUrls([...urls, url]);
        }}>add url</button>
      </div>
      <div>
        <ul>
          {
            urls.map((url, index) => {
              if (url === '') return null;
              return <li key={index} className='flex items-center gap-2'>
                <a href={url}>{url}</a>
                <button
                  className='btn btn-outline btn-xs btn-error'
                  onClick={async () => {
                    const urls = await removeUrl(url);
                    setUrls(urls);
                  }}>
                  <XMarkIcon className='w-4 h-4' />
                </button>
              </li>;
            })
          }
        </ul>
      </div>
    </div>
  </>;
}