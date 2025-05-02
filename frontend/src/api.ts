import { FormData } from './components/Form/SignupForm'

export const submitForm = async (formData: FormData) => {
  const response = await fetch(`${import.meta.env.VITE_API}/survey/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  })

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`)
  }
}
