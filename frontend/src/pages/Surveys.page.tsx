import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
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

interface FetchData {
  id: string
  name: string
  schemaJson: string
  status: string
  task_id: string
}

export default function SurveysPage() {
  const [data, setData] = useState<FetchData[]>([])
  useEffect(() => {
    const handleGetAllSurveys = async () => {
      const data = (await getAllSurveys()) as FetchData[]
      setData(data)
    }
    handleGetAllSurveys()
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
                  <TableCell>{item.status === 'COMPLETED' ? (
                    <a href={`/api/processing/tasks/${item.task_id}/file`} download>
                      Download Result
                    </a>
                  ) : (
                    item.status
                  )}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        closeSurvey(item.id)
                      }}>Close</Button>
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
