import { useEffect, useState } from 'react'
import { Layout } from '@/features/shared'
import {
  Box,
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
      <Box sx={{ p: 4 }}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="flex-end" alignItems="center" mb={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/surveys/new')}
              >
                Add Form
              </Button>
            </Box>
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
                      <Box display="flex" gap={1}>
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
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  )
}
