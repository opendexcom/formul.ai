import { Layout } from '@/features/shared'
import { SurveyForm } from '@/features/surveys'
import { useParams } from 'react-router'

function FormPage() {
  const { id } = useParams()
  return (
    <>
      <Layout title="Survey">
        <SurveyForm form-id={id} />
      </Layout>
    </>
  )
}

export default FormPage
