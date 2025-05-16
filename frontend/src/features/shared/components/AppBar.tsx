import { Box, Toolbar, AppBar as MuiBar, Typography } from '@mui/material'

export const AppBar = ({ title }: { title: string }) => {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <MuiBar position="static">
        <Toolbar>
          <>
            <Typography variant="h6" component="h1">
              {title}
            </Typography>
            <Typography variant="h6" component="div">
              &nbsp;- Formul.ai
            </Typography>
          </>
        </Toolbar>
      </MuiBar>
    </Box>
  )
}
