import { getMessage } from '../languages';

const shortcutsUrl = 'chrome://extensions/shortcuts';

/**
 * The opt-in for the two chords Chrome will not let the extension claim by
 * itself.
 *
 * A page cannot link to `chrome://` — the navigation is blocked and the anchor
 * does nothing — but an extension page may open one through `chrome.tabs.create`,
 * which is why this is a button rather than a link.
 */
export function ReclaimedApp() {
  const openShortcuts = () => {
    void chrome.tabs.create({ url: shortcutsUrl });
  };

  return <>
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>Reserved chords</h2>
      {/* No opacity here: it would composite onto the <code> chips, whose
          palette then sinks below 4.5:1 in the dark theme (measured 4.32:1). */}
      <p className='text-sm m-0'>
        Chrome handles <code>Ctrl</code> + <code>w</code> and <code>Ctrl</code> + <code>t</code>{' '}
        before any page sees them, so Razorshell cannot ship them as defaults. Assign them once
        on Chrome&apos;s shortcuts page and they reach the extension while a text field has focus:
        <code>Ctrl</code> + <code>w</code> kills the word before the cursor, <code>Ctrl</code> +{' '}
        <code>t</code> swaps the two characters around it. Outside a text field the tab still
        closes and a new tab still opens.
      </p>
      <div className='tooltip tooltip-top w-fit' data-tip={getMessage('tooltip_reclaimed')()}>
        <button
          className='btn btn-primary btn-sm'
          data-testid='open-shortcuts'
          onClick={openShortcuts}
        >
          Open shortcuts page
        </button>
      </div>
    </div>
  </>;
}
