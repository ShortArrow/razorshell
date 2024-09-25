import { defaultKeymap } from "../keymap"
export function KeymapApp() {
  return <>
    <div className='flex flex-col gap-3'>
      <h2 className='h2'>Keymap</h2>
      <p>W.I.P.</p>
      {
        defaultKeymap.map((key, index) => {
          return (
            <div className="tooltip tooltip-left"
              hidden={key.description ? true : false}
              data-tip={key.description ? key.description() : ""}>
              <div key={index} className="flex items-center gap-4">
                <p className="flex items-center gap-2">
                  {key.ctrl ? <><kbd className="kbd text-base-content">ctrl</kbd><span>+</span></> : ''}
                  {key.alt ? <><kbd className="kbd text-base-content">alt</kbd><span>+</span></> : ''}
                  {key.shift ? <><kbd className="kbd text-base-content">shift</kbd><span>+</span></> : ''}
                  <kbd className="kbd text-base-content">{key.key}</kbd>
                </p>
                <p>{key.label}</p>
              </div>
            </div>
          )
        })
      }
    </div>
  </>
}