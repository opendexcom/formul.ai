import { ReactNode } from 'react'
import { AppBar } from './AppBar'

interface LayoutProps {
  title?: string
  children: ReactNode
  footer?: ReactNode
}

export const Layout = ({ children, title, footer }: LayoutProps) => {
  return (
    <>
      <AppBar title={title ?? ''} />
      {children}
      {footer}
    </>
  )
}
