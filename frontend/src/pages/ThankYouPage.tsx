import { Card, CardContent, Typography } from '@mui/material'
import WavingHandIcon from '@mui/icons-material/WavingHand'
import { Layout } from '../components/Layout'

export default function ThankYouPage() {
  return (
    <>
      <Layout title="Thank you">
        <Card>
          <CardContent>
            <Typography variant="body1">
              <WavingHandIcon color="primary" />
              Thank you for your feedback!
            </Typography>
            <Typography variant="body2">
              You may now close this tab or return to the homepage.
            </Typography>
          </CardContent>
        </Card>
      </Layout>
    </>
  )
}
