import React from 'react'
import ReactDOM from 'react-dom/client'
import OptionsUI from './options-ui.tsx'
import { initI18n } from './languages.ts'
import { initKeymap } from './keymapstore.ts'
import './css/options.css'

Promise.all([initI18n(), initKeymap()]).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <OptionsUI />
    </React.StrictMode>,
  )
})
