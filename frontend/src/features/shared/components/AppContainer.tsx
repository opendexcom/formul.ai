import { styled } from '@mui/material/styles'

export const AppContainer = styled('div')(({ theme }) => ({
  margin: 0,
  padding: 0,
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.default,
}))
