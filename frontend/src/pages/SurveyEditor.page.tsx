import { Layout } from '@/features/shared'
import {
  Alert,
  AlertColor,
  Button,
  Card,
  CardContent,
  Grid2,
  Snackbar,
  SnackbarCloseReason,
  TextField,
  Typography,
} from '@mui/material'
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
  const [loading, setLoading] = useState(false)
  const [jsonError, setJsonError] = useState(false)
  const [schemaChanged, setSchemaChanged] = useState(false)
  const [snackBarData, setSnackBarData] = useState<{
    open: boolean
    variant: AlertColor
    message: string
  }>({ open: false, variant: 'info', message: '' })

  const handleSaveSurvey = async () => {
    if (jsonError) {
      setSnackBarData({ open: true, variant: 'error', message: 'Fix JSON schema and try again' })
      return
    }

    setLoading(true)
    try {
      await addNewForm(newFormSchema.title ?? '', newFormSchema)
      navigate('/surveys', {
        state: {
          snackbar: { message: `Added new survey - ${newFormSchema.title}`, severity: 'success' },
        },
      })
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message)
        setSnackBarData({ open: true, variant: 'error', message: error.message })
      } else {
        console.error('An unknown error occurred')
      }
    }
  }

  const handleApplySurveyChanges = () => {
    try {
      setNewFormSchema(JSON.parse(textFieldRef.current?.value || '{}'))
      setJsonError(false)
      setSnackBarData({ open: true, variant: 'info', message: 'JSON data was updated' })
      setSchemaChanged(false)
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message)
        setJsonError(true)
        setSnackBarData({ open: true, variant: 'error', message: error.message })
      } else {
        console.error('An unknown error occurred')
      }
    }
  }

  const handleClose = (_event: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
    if (reason === 'clickaway') {
      return
    }

    setSnackBarData((prev) => ({ ...prev, open: false }))
  }

  return (
    <Layout title="Create Survey">
      <Snackbar open={snackBarData.open} autoHideDuration={5000} onClose={handleClose}>
        <Alert onClose={handleClose} variant="filled" severity={snackBarData.variant}>
          {snackBarData.message}
        </Alert>
      </Snackbar>
      <Card>
        <CardContent>
          <Grid2 container spacing={3} columns={{ xs: 1, md: 12 }}>
            <Grid2 size={{ xs: 1, md: 6 }}>
              <Card>
                <CardContent>
                  <Grid2 container spacing={2}>
                    <TextField
                      error={jsonError}
                      inputRef={textFieldRef}
                      fullWidth
                      multiline
                      minRows={20}
                      id="outlined-basic"
                      label="JSON Schema"
                      variant="outlined"
                      defaultValue={JSON.stringify(newFormSchema, null, '\t')}
                      onChange={() => setSchemaChanged(true)}
                    />
                    <Button onClick={handleApplySurveyChanges} variant="contained">
                      Apply changes
                    </Button>
                  </Grid2>
                </CardContent>
              </Card>
            </Grid2>
            <Grid2 size={{ xs: 1, md: 6 }}>
              <Card>
                <CardContent>
                  {newFormSchema ? (
                    <>
                      <Form uiSchema={uiSchema} schema={newFormSchema} validator={validator} />
                      {schemaChanged && (
                        <Typography variant="subtitle2">
                          Schema was changed. Apply changes and save again.
                        </Typography>
                      )}
                      <Button
                        disabled={loading || schemaChanged}
                        onClick={handleSaveSurvey}
                        variant="contained"
                        color="success"
                      >
                        Save Schema
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
