import { UrlApp } from './ui/url';
import { LangApp } from './ui/language';
import { TitleApp } from './ui/title';
import { TestApp } from './ui/testui';
import { ThemeApp } from './ui/theme';
import { FooterApp } from './ui/footer';

function OptionsUI() {

  return (
    <>
      <div className='h-dvh flex flex-col'>
        <div className='prose flex flex-col p-6 gap-6 mx-auto grow'>
          <ThemeApp />
          <TitleApp />
          <TestApp />
          <UrlApp />
          <LangApp />
        </div>
        <div className='grow'></div>
        <FooterApp />
      </div>
    </>
  );
}

export default OptionsUI;
