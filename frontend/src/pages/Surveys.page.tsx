import { useEffect, useState } from 'react'
import { Layout } from '@/features/shared'
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { closeSurvey, getAllSurveys } from '../../lib/api'
import { useNavigate } from 'react-router'

interface FetchData {
  id: string
  name: string
  schemaJson: string
  status: string
  task_id: string
}

export default function SurveysPage() {
  const [data, setData] = useState<FetchData[]>([])

  const navigate = useNavigate()

  useEffect(() => {
    const handleGetAllSurveys = async () => {
      const data = (await getAllSurveys()) as FetchData[]
      setData(data)
    }

    // pull data from api every 3 seconds
    const interval = setInterval(() => {
      handleGetAllSurveys()
    }, 3000)

    handleGetAllSurveys()
    return () => {
      clearInterval(interval)
    }
  }, [])
  return (
    <Layout title="Admin page">
      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell scope="col">ID</TableCell>
                <TableCell scope="col">Name</TableCell>
                <TableCell scope="col">Status</TableCell>
                <TableCell scope="col">Button</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((item: FetchData) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.status === 'COMPLETED' ? (
                      <a href={`/api/processing/tasks/${item.task_id}/file`} download>
                        Download Result
                      </a>
                    ) : (
                      item.status
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        closeSurvey(item.id)
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => navigate(`/form/${item.id}`)} // Navigate to /form/:id
                    >
                      Open Form
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  )
}
