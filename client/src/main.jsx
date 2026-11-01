import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bux-assets/css/bux-styles.css'
import './assets/css/ba-styles.css'
import 'quill/dist/quill.snow.css'
import 'katex/dist/katex.min.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
) 