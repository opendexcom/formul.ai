import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import './index.css'
import App from './pages/App.tsx'
import ThankYouPage from './pages/ThankYouPage.tsx'
import SurveysPage from './pages/SurveysPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/surveys" element={<SurveysPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
