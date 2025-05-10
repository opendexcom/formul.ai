import { Layout } from '../components/Layout'
import { Typography } from '@mui/material'

function Error404Page() {
  return (
    <>
      <Layout title="404 Not Found">
        <Typography variant="h1" align='center'>
          404 Not Found
        </Typography>
      </Layout>
    </>
  )
}

export default Error404Page
