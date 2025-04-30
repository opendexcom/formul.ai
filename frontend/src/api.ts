import { FormData } from './components/Form/Form'

export const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>, formData: FormData) => {
  e.preventDefault()

  if (formData.name === '' || formData.age === '' || formData.favoriteColor === '') {
    return
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_API}survey/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error('An unknown error occurred')
    }
  }
}
