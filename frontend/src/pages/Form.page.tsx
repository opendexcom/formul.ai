import { Layout } from '../components/Layout'
import { SurveyForm } from '../components/Form/SurveyForm'
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
