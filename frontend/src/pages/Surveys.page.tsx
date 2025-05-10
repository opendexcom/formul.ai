import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import {
  Card,
  CardContent,
} from '@mui/material'
import { getAllSurveys } from '../../lib/api'

interface FetchData {
  id: string
  name: string
  schemaJson: string
}

export default function SurveysPage() {
  const [data, setData] = useState<FetchData | null>(null)
  useEffect(() => {
    const handleGetAllSurveys = async () => {
      const data = (await getAllSurveys()) as FetchData
      setData(data)
    }
    handleGetAllSurveys()
  }, [])
  return (
    <Layout title="Admin page">
      <Card>
        <CardContent>
          <></>
        </CardContent>
      </Card>
    </Layout>
  )
}
