import { useEffect, useState } from 'react'
import { getForm, submitForm } from '../../../lib/api'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@mui/material'
import { IChangeEvent, withTheme } from '@rjsf/core'
import { Theme } from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'

interface SurveyFormProps {
  'form-id'?: string;
}

export const SurveyForm = ({ 'form-id': formId }: SurveyFormProps) => {
  const navigate = useNavigate()
  
  type FormDataType = {
    schema: object
    uiData?: object
  } | null

  const [formData, setFormData] = useState<FormDataType>(null)

  const Form = withTheme(Theme)

  useEffect(() => {
    const fetchData = async (id: string) => {
      const schema = await fetchForm(id)
      const parsedSchema = JSON.parse(schema.schemaJson)
      setFormData(parsedSchema)
    }

    const id = formId ? formId : ''
    fetchData(id)
  }, [formId])

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

  const handleSubmitForm = async (
    formData: IChangeEvent,
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()

    try {
      const id = formId ? formId : ''
      await submitForm(id, formData.formData)
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
