import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp } from 'antd'
import './color.css'
import './index.css'
import './assets/registry'
import App from './App.tsx'
import { ToastInit } from './components/Toast'
import { DialogsInit } from './components/Dialogs'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AntdApp>
      <ToastInit />
      <DialogsInit />
      <App />
    </AntdApp>
  </StrictMode>,
)
