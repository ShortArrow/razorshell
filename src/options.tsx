import React from 'react'
import ReactDOM from 'react-dom/client'
import OptionsUI from './options-ui.tsx'
import { initI18n } from './languages.ts'
import './css/options.css'

initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <OptionsUI />
    </React.StrictMode>,
  )
})
