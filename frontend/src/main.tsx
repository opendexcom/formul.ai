import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import FormPage from './pages/FormPage.tsx'
import ThankYouPage from './pages/ThankYouPage.tsx'
import SurveysPage from './pages/SurveysPage.tsx'
import Error404Page from './pages/Error404Page.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/form" element={<FormPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="*" element={<Error404Page />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
