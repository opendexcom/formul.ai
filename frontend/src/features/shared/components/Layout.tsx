import { ReactNode, useEffect, useState } from 'react'
import { AppBar } from './AppBar'
import { Alert, AlertColor, Box, Snackbar } from '@mui/material'
import { useLocation } from 'react-router'

interface LayoutProps {
  title?: string
  children: ReactNode
  footer?: ReactNode
}

export const Layout = ({ children, title, footer }: LayoutProps) => {
  const location = useLocation()
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' })

  useEffect(() => {
    const snackbarData = location.state?.snackbar
    if (snackbarData) {
      setSnackbar({ ...snackbarData, open: true })
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const handleClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }))
  }

  return (
    <Box>
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={handleClose}>
        <Alert onClose={handleClose} variant="filled" severity={snackbar.severity as AlertColor}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      <AppBar title={title ?? ''} />
      {children}
      {footer}
    </Box>
  )
}
