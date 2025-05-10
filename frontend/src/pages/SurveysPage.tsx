import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import {
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { getAllSurveys } from '../../lib/api'

interface FetchData {
  id: string
  name: string
  schemaJson: string
}
function createData(id: number, text: string, type: string) {
  return { id, text, type }
}

const rows = [createData(1, 'fds', 'gfd')]
function SurveyTable() {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Dessert (100g serving)</TableCell>
            <TableCell align="right">Calories</TableCell>
            <TableCell align="right">Fat&nbsp;(g)</TableCell>
            <TableCell align="right">Carbs&nbsp;(g)</TableCell>
            <TableCell align="right">Protein&nbsp;(g)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell component="th" scope="row">
                {row.name}
              </TableCell>
              <TableCell align="right">{row.calories}</TableCell>
              <TableCell align="right">{row.fat}</TableCell>
              <TableCell align="right">{row.carbs}</TableCell>
              <TableCell align="right">{row.protein}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
export default function SurveysPage() {
  const [data, setData] = useState<FetchData | null>(null)
  useEffect(() => {
    async function handleGetAllSurveys() {
      const data = (await getAllSurveys()) as FetchData
      setData(data)
    }
    handleGetAllSurveys()
  }, [])
  console.log(data)
  return (
    <Layout title="Admin page">
      <Card>
        <CardContent>
          <SurveyTable />
        </CardContent>
      </Card>
    </Layout>
  )
}
