import { Layout } from '../features/shared/components/Layout'
import { SurveyForm } from '@/features/surveys/components/SurveyForm'
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
