import { useState } from 'react';
import { getMessage } from '../languages';
import { SettingsFile, parseSettings, serializeSettings } from '../settingsio';

const storedKeys = ['urlPolicy', 'keymapOverrides', 'language', 'theme', 'enableContentEditable'];
const downloadName = 'razorshell-config.json';

type Result = { kind: 'none' } | { kind: 'applied' } | { kind: 'error'; message: string };

async function readSettings(): Promise<SettingsFile> {
  const data = await chrome.storage.sync.get(storedKeys) as Record<string, unknown>;
  const settings: SettingsFile = { version: 1 };
  for (const key of storedKeys) {
    if (data[key] === undefined) continue;
    Object.assign(settings, { [key]: data[key] });
  }
  return settings;
}

function download(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = downloadName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function writableEntries(settings: SettingsFile): Record<string, unknown> {
  const source = settings as unknown as Record<string, unknown>;
  const entries: Record<string, unknown> = {};
  for (const key of storedKeys) {
    if (source[key] === undefined) continue;
    entries[key] = source[key];
  }
  return entries;
}

export function ConfigApp() {
  const [text, setText] = useState<string>('');
  const [result, setResult] = useState<Result>({ kind: 'none' });

  const exportSettings = async () => {
    download(serializeSettings(await readSettings()));
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setResult({ kind: 'none' });
  };

  const apply = async () => {
    const parsed = parseSettings(text);
    if (!parsed.ok) {
      setResult({ kind: 'error', message: parsed.error });
      return;
    }
    await chrome.storage.sync.set(writableEntries(parsed.settings));
    setResult({ kind: 'applied' });
  };

  return <>
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>Config</h2>
      <div className='flex items-center gap-2'>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_config_export')()}>
          <button className='btn btn-primary' data-testid='config-export' onClick={exportSettings}>Export</button>
        </div>
        <input
          type='file'
          accept='.json,application/json'
          data-testid='config-file'
          className='file-input file-input-bordered file-input-sm grow'
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
      </div>
      <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_config_import')()}>
        <textarea
          data-testid='config-text'
          className='textarea textarea-bordered w-full font-mono'
          rows={6}
          placeholder='{"version": 1, ...}'
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult({ kind: 'none' });
          }}
        />
      </div>
      <div className='flex items-center gap-2'>
        <button className='btn btn-primary' data-testid='config-apply' onClick={apply}>Apply</button>
        <div className='min-h-6' data-testid='config-result'>
          {result.kind === 'applied' ? <span className='badge badge-primary'>applied</span> : null}
          {result.kind === 'error' ? <span className='text-error'>{result.message}</span> : null}
        </div>
      </div>
    </div>
  </>;
}
