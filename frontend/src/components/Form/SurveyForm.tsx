import { useEffect, useState } from 'react'
import { getForm, submitForm } from '../../../lib/api'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@mui/material'
import { withTheme } from '@rjsf/core'
import { Theme } from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'

interface SurveyFormProps {
  'form-id'?: string;
}

export const SurveyForm = (props:SurveyFormProps ) => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<any>(null)

  const Form = withTheme(Theme)

  useEffect(() => {
    const fetchData = async (id: string) => {
      const schema = await fetchForm(id)
      const parsedSchema = JSON.parse(schema.schemaJson)
      setFormData(parsedSchema)
    }
    
    const id = props['form-id'] ? props['form-id'] : ''
    fetchData(id)
  }, [])

  const fetchForm = async (id: string) => {
    try {
      const schema = await getForm(id)
      const parsedSchema = JSON.parse(schema.schemaJson)
      const uiData = schema.uiData ? JSON.parse(schema.uiData) : {}
      setFormData({ schema: parsedSchema, uiData })
      return schema
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message)
      } else {
        console.error('An unknown error occurred')
      }
    }
  }

  const handleSubmitForm = async (formData: any, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      await submitForm(formData.formData)
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message)
      } else {
        console.error('An unknown error occurred')
      }
    } finally {
      navigate('/thank-you')
    }
  }

  return (
    <>
      <Card>
        <CardContent>
          {formData && <Form schema={formData} onSubmit={handleSubmitForm} validator={validator} />}
        </CardContent>
      </Card>
    </>
  )
}

// const LeftAlignedFormLabel = styled(FormLabel)({
//   textAlign: 'left',
