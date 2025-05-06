import { useState } from 'react'
import { submitForm } from '../../../lib/api'
import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  styled,
  TextField,
  Typography,
} from '@mui/material'

export interface FormData {
  tasks: { name: string; value: boolean }[]
  rating: string
  likes: string
  improvements: string
}

export const SurveyForm = () => {
  const [formIsSubmitting, setFormIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    tasks: [
      { name: 'front', value: false },
      { name: 'backend', value: false },
      { name: 'devops', value: false },
      { name: 'inne', value: false },
    ],
    rating: '',
    likes: '',
    improvements: '',
  })

  const [formErrors, setFormErrors] = useState({
    tasks: '',
    rating: '',
    likes: '',
    improvements: '',
  })

  const validateFormData = (formData: FormData) => {
    const errors = {
      tasks: '',
      rating: '',
      likes: '',
      improvements: '',
    }

    const atLeastOneTaskChecked = Object.values(formData.tasks).some((v) => v)
    if (!atLeastOneTaskChecked) errors.tasks = 'Wybierz przynajmniej jedno zadanie.'

    if (!formData.rating) errors.rating = 'Ocena jest wymagana.'
    if (!formData.likes.trim()) errors.likes = 'To pole jest wymagane.'
    if (!formData.improvements.trim()) errors.improvements = 'To pole jest wymagane.'

    return errors
  }

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const newErrors = validateFormData(formData)

    setFormErrors(newErrors)

    const hasErrors = Object.values(newErrors).some((msg) => msg !== '')
    if (hasErrors) return

    setFormIsSubmitting(true)

    try {
      await submitForm(formData)
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message)
      } else {
        console.error('An unknown error occurred')
      }
    } finally {
      setFormIsSubmitting(false)
    }
  }

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target
    setFormData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.name === name ? { ...task, value: checked } : task)),
    }))
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <div>
      <Typography variant="h1">Formul.ai</Typography>
      <Stack component="form" onSubmit={handleSubmitForm} spacing={4}>
        <FormControl>
          <LeftAlignedFormLabel error={!!formErrors.tasks}>
            Co masz robić w projekcie
          </LeftAlignedFormLabel>
          <FormGroup>
            {formData.tasks.map((task) => (
              <FormControlLabel
                key={task.name}
                control={
                  <Checkbox name={task.name} checked={task.value} onChange={handleCheckboxChange} />
                }
                label={task.name}
              />
            ))}
          </FormGroup>
          {formErrors.tasks && (
            <Typography color="error" variant="caption">
              {formErrors.tasks}
            </Typography>
          )}
        </FormControl>

        <FormControl>
          <FormLabel error={!!formErrors.rating}>Jak oceniasz proces do tego momentu</FormLabel>
          <Grid container justifyContent="center">
            <RadioGroup row name="rating" value={formData.rating} onChange={handleChange}>
              {Array.from({ length: 10 }, (_, i) => (
                <FormControlLabel
                  key={i}
                  value={String(i + 1)}
                  control={<Radio sx={{ p: 0.5 }} />}
                  label={i + 1}
                  labelPlacement="bottom"
                  sx={{ mx: 0.5 }}
                />
              ))}
            </RadioGroup>
          </Grid>
          {formErrors.rating && (
            <Typography color="error" variant="caption">
              {formErrors.rating}
            </Typography>
          )}
        </FormControl>

        <TextField
          label="Co Ci się podoba"
          slotProps={{ inputLabel: { shrink: true } }}
          multiline
          rows={4}
          name="likes"
          value={formData.likes}
          onChange={handleChange}
          error={!!formErrors.likes}
          helperText={formErrors.likes}
        />

        <TextField
          multiline
          label="Co byś poprawił"
          slotProps={{ inputLabel: { shrink: true } }}
          rows={4}
          name="improvements"
          value={formData.improvements}
          onChange={handleChange}
          error={!!formErrors.improvements}
          helperText={formErrors.improvements}
        />

        <Button type="submit" disabled={formIsSubmitting} variant="contained">
          {formIsSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </Stack>
    </div>
  )
}

const LeftAlignedFormLabel = styled(FormLabel)({
  textAlign: 'left',
})
