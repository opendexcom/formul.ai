import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import FormPage from './pages/Form.page.tsx'
import ThankYouPage from './pages/ThankYou.page.tsx'
import SurveysPage from './pages/Surveys.page.tsx'
import Error404Page from './pages/Error404.page.tsx'
import AppContainer from './components/AppContainer.tsx'
import theme from './theme/index.ts'
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
import { Homepage } from './pages/Homepage.page.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <GlobalStyles
        styles={{
          body: {
            margin: 0,
            padding: 0,
            boxSizing: 'border-box',
          },
        }}
      />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContainer>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/form/:id" element={<FormPage />} />
              <Route path="/thank-you" element={<ThankYouPage />} />
              <Route path="/surveys" element={<SurveysPage />} />
              <Route path="*" element={<Error404Page />} />
            </Routes>
          </BrowserRouter>
        </AppContainer>
      </ThemeProvider>
    </>
  </StrictMode>,
)
