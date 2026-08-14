import { defaultKeymap } from "../keymap"
export function KeymapApp() {
  return <>
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>Keymap</h2>
      <table className='table table-sm'>
        <tbody>
          {
            defaultKeymap.map((key, index) => {
              return (
                <tr key={index}>
                  <td>
                    <span className='tooltip tooltip-top flex items-center gap-1'
                      data-tip={key.description ? key.description() : ""}>
                      {key.ctrl ? <><kbd className="kbd text-base-content">ctrl</kbd><span>+</span></> : ''}
                      {key.alt ? <><kbd className="kbd text-base-content">alt</kbd><span>+</span></> : ''}
                      {key.shift ? <><kbd className="kbd text-base-content">shift</kbd><span>+</span></> : ''}
                      <kbd className="kbd text-base-content">{key.key}</kbd>
                    </span>
                  </td>
                  <td>{key.label}</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </div>
  </>
}
