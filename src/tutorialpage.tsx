import React from 'react'
import ReactDOM from 'react-dom/client'
import { TutorialApp } from './ui/tutorial.tsx'
import { fireConfetti } from './ui/celebrate.ts'
import { getActiveKeymap, initKeymap } from './keymapstore.ts'
import './css/options.css'

// A failed init falls back to packaged defaults; a blank page would not.
void initKeymap().catch(console.error).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <main className="flex flex-col max-w-xl gap-4 p-6 mx-auto">
        <h1 className="text-2xl font-bold">Razorshell tutorial</h1>
        <TutorialApp keymap={getActiveKeymap()} celebrate={fireConfetti} />
      </main>
    </React.StrictMode>,
  )
})
