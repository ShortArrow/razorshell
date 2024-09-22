import { UrlApp } from './ui/url';
import { LangApp } from './ui/language';
import { TitleApp } from './ui/title';

function OptionsUI() {

  return (
    <>
      <div className='flex flex-col p-6 gap-6 container mx-auto'>
        <TitleApp />
        <UrlApp />
        <LangApp />
      </div>
    </>
  );
}

export default OptionsUI;
