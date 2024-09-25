import iconImage from '../images/razorshell.svg'
export function TitleApp() {
  return <>
    <div className='flex flex-col items-center gap-3'>
      <img src={iconImage} alt='icon' className='w-auto h-16' />
      <div className='flex justify-center items-center'>
        <h1>Razorshell Options</h1>
      </div>
    </div>
  </>
}