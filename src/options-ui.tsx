import { UrlApp } from './ui/url';
import { LangApp } from './ui/language';
import { TitleApp } from './ui/title';
import { TestApp } from './ui/testui';

function OptionsUI() {

  return (
    <>
      <div className='prose flex flex-col p-6 gap-6 container mx-auto'>
        <TitleApp />
        <TestApp />
        <UrlApp />
        <LangApp />
      </div>
    </>
  );
}

export default OptionsUI;
