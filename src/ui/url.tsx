import { useEffect, useState } from 'react';
import { saveUrl, showUrls, removeUrl } from '../urllist';

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

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
                  className='btn btn-square btn-outline btn-xs btn-error'
                  onClick={async () => {
                    const urls = await removeUrl(url);
                    setUrls(urls);
                  }}>
                  <DeleteIcon />
                </button>
              </li>;
            })
          }
        </ul>
      </div>
    </div>
  </>;
}