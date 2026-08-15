import { useEffect, useReducer } from 'react';
import { onLanguageChange } from './languages';
import { UrlApp } from './ui/url';
import { LangApp } from './ui/language';
import { TitleApp } from './ui/title';
import { TestApp } from './ui/testui';
import { ThemeApp } from './ui/theme';
import { FooterApp } from './ui/footer';
import { KeymapApp } from './ui/keymap';
import { RichTextApp } from './ui/richtext';
import { ConfigApp } from './ui/config';

function OptionsUI() {
  const [generation, bump] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    onLanguageChange(bump);
  }, []);

  return (
    <>
      <div className='h-dvh flex flex-col' key={generation}>
        <div className='prose flex flex-col p-6 gap-6 mx-auto grow'>
          <ThemeApp />
          <TitleApp />
          <TestApp />
          <UrlApp />
          <RichTextApp />
          <KeymapApp />
          <LangApp />
          <ConfigApp />
        </div>
        <div className='grow'></div>
        <FooterApp />
      </div>
    </>
  );
}

export default OptionsUI;
