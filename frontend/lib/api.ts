import { FormData } from '../src/components/Form/SurveyForm'

const surveyId = '23e4693c-3975-4d91-a2f2-190993043c1c'

export const submitForm = async (formData: FormData) => {
  const url = new URL(
    `/api/survey/v1/surveys/${surveyId}/submit`,
    import.meta.env.VITE_API,
  ).toString()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ surveyId: surveyId, answersJson: JSON.stringify(formData) }),
  })

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`)
  }
}
