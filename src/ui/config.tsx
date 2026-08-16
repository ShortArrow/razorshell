import { useState } from 'react';
import { getMessage } from '../languages';
import { SettingsFile, parseSettings, serializeSettings } from '../settingsio';
import sampleConfig from '../../config.sample.json';

const storedKeys = ['urlPolicy', 'keymapOverrides', 'language', 'theme', 'enableContentEditable'];
const downloadName = 'razorshell-config.json';
const sampleName = 'config.sample.json';
const maxFileSize = 1024 * 1024;

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

function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
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
  const [fileName, setFileName] = useState<string>('');
  const [result, setResult] = useState<Result>({ kind: 'none' });

  const exportSettings = async () => {
    const serialized = serializeSettings(await readSettings());
    // Storage may hold values an older version or an external writer left
    // behind that our own import would refuse. Downloading such a file hands
    // the user a config that cannot be applied, so it is checked first.
    const parsed = parseSettings(serialized);
    if (!parsed.ok) {
      setResult({ kind: 'error', message: `cannot export: ${parsed.error}` });
      return;
    }
    download(serialized, downloadName);
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxFileSize) {
      setResult({ kind: 'error', message: 'file too large (max 1 MiB)' });
      return;
    }
    let content: string;
    try {
      content = await file.text();
    } catch (failure) {
      setResult({
        kind: 'error',
        message: `could not read file: ${failure instanceof Error ? failure.message : String(failure)}`,
      });
      return;
    }
    setText(content);
    setFileName(file.name);
    setResult({ kind: 'none' });
  };

  const downloadSample = () => {
    // Round-tripping the packaged sample through the parser means the file a
    // user downloads is one the importer accepts by construction.
    const parsed = parseSettings(JSON.stringify(sampleConfig));
    if (!parsed.ok) {
      setResult({ kind: 'error', message: `cannot export: ${parsed.error}` });
      return;
    }
    download(serializeSettings(parsed.settings), sampleName);
  };

  const apply = async () => {
    const parsed = parseSettings(text);
    if (!parsed.ok) {
      setResult({ kind: 'error', message: parsed.error });
      return;
    }
    try {
      await chrome.storage.sync.set(writableEntries(parsed.settings));
    } catch (failure) {
      setResult({ kind: 'error', message: failure instanceof Error ? failure.message : String(failure) });
      return;
    }
    setResult({ kind: 'applied' });
  };

  return <>
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>Config</h2>
      <div className='flex items-center gap-2'>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_config_export')()}>
          <button className='btn btn-primary btn-sm' data-testid='config-export' onClick={exportSettings}>Export</button>
        </div>
        <button className='btn btn-outline btn-sm' data-testid='config-sample' onClick={downloadSample}>Sample</button>
        <label className='btn btn-outline btn-sm' htmlFor='config-file-input'>Choose file…</label>
        <input
          type='file'
          id='config-file-input'
          accept='.json,application/json'
          data-testid='config-file'
          className='hidden'
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
        <span className='text-sm opacity-80'>{fileName}</span>
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
            setFileName('');
            setResult({ kind: 'none' });
          }}
        />
      </div>
      <div className='flex items-center gap-2'>
        <button className='btn btn-primary btn-sm' data-testid='config-apply' onClick={apply}>Apply</button>
        <div className='min-h-6' data-testid='config-result'>
          {result.kind === 'applied' ? <span className='badge badge-primary'>applied</span> : null}
          {result.kind === 'error' ? <span className='text-error'>{result.message}</span> : null}
        </div>
      </div>
    </div>
  </>;
}
