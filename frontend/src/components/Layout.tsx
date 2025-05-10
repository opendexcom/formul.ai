import { ReactNode } from 'react'
import { AppBar } from './AppBar'
import { Box } from '@mui/material'

interface LayoutProps {
  title?: string
  children: ReactNode
  footer?: ReactNode
}

export const Layout = ({ children, title, footer }: LayoutProps) => {
  return (
    <Box>
      <AppBar position="static" title={title ?? ''} />
      {children}
      {footer}
    </Box>
  )
}
