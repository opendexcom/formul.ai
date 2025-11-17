export const getAllSurveys = async () => {
  const url = new URL('/api/survey/v1/surveys', import.meta.env.VITE_API)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`)
  }
  return await response.json()
}

export const closeSurvey = async (surveyId: string) => {
  const url = new URL(
    `/api/survey/v1/surveys/${surveyId}/close`,
    import.meta.env.VITE_API,
  ).toString()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`)
  }

  return response.json()
}


export const submitForm = async (surveyId: string, formData: FormData) => {
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

export const getForm = async (id: string) => {
  const url = new URL(`/api/survey/v1/surveys/${id}`, import.meta.env.VITE_API).toString()

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`)
  }

  return response.json()
}
