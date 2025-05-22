import { Layout } from '@/features/shared'
import { Button, Card, CardContent, Grid2, TextField } from '@mui/material'
import { withTheme } from '@rjsf/core'
import { Theme } from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useRef, useState } from 'react'
import { RJSFSchema, UiSchema } from '@rjsf/utils'
import { addNewForm } from '../../lib/api'
import { useNavigate } from 'react-router'

export const SurveyEditor = () => {
  const uiSchema: UiSchema = {
    'ui:options': { submitButtonOptions: { norender: true } },
  }
  const Form = withTheme(Theme)
  const navigate = useNavigate()

  const textFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const [newFormSchema, setNewFormSchema] = useState<RJSFSchema>({
    title: 'New form',
    description: '',
    type: 'object',
    required: ['firstName'],
    properties: {
      firstName: {
        type: 'string',
        title: 'First name',
        default: 'Chuck',
      },
    },
  })

  const handleSaveSurvey = async () => {
    try {
      await addNewForm(newFormSchema.title ?? '', JSON.stringify(newFormSchema))
      navigate('/surveys')
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message)
      } else {
        console.error('An unknown error occurred')
      }
    }
  }

  return (
    <Layout title="Create Survey">
      <Card>
        <CardContent>
          <Grid2 container spacing={3}>
            <Grid2 size={6}>
              <Card>
                <CardContent>
                  <Grid2 container spacing={2}>
                    <TextField
                      inputRef={textFieldRef}
                      fullWidth
                      multiline
                      minRows={20}
                      id="outlined-basic"
                      label="JSON Schema"
                      variant="outlined"
                      defaultValue={JSON.stringify(newFormSchema, null, '\t')}
                    />
                    <Button
                      onClick={() =>
                        setNewFormSchema(JSON.parse(textFieldRef.current?.value || '{}'))
                      }
                      variant="contained"
                    >
                      Apply changes
                    </Button>
                  </Grid2>
                </CardContent>
              </Card>
            </Grid2>
            <Grid2 size={6}>
              <Card>
                <CardContent>
                  {newFormSchema ? (
                    <>
                      <Form uiSchema={uiSchema} schema={newFormSchema} validator={validator} />
                      <Button onClick={handleSaveSurvey} variant="contained" color="success">
                        Save form
                      </Button>
                    </>
                  ) : (
                    <p>Add first element to survey</p>
                  )}
                </CardContent>
              </Card>
            </Grid2>
          </Grid2>
        </CardContent>
      </Card>
    </Layout>
  )
}
