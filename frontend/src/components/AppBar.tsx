import { Box, Toolbar, AppBar as MuiBar, Grid, Typography } from '@mui/material'

export const AppBar = ({ title }: { title: string }) => {
  return (
    <Box sx={{ flexGrow: 1, mb: 5 }}>
      <MuiBar position="static">
        <Toolbar>
          <Grid container justifyContent="space-between" width="100%">
            <Typography variant="h6" component="h1">
              {title}
            </Typography>
            <Typography variant="h6" component="div">
              Formul.ai
            </Typography>
          </Grid>
        </Toolbar>
      </MuiBar>
    </Box>
  )
}
