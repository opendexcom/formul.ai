import { FormData } from './components/Form/SignupForm'

const ID = '23e4693c-3975-4d91-a2f2-190993043c1c'

export const submitForm = async (formData: FormData) => {
  const response = await fetch(`${import.meta.env.VITE_API}/api/survey/v1/surveys/${ID}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ surveyId: ID, answersJson: JSON.stringify(formData) }),
  })

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`)
  }
}
