import { useState } from 'react'
import { FormField } from './components/FormField.tsx'
export interface FormData {name:string, age:string, favoriteColor:string, preferredContactMethod:string }

function App() {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    favoriteColor: '',
    preferredContactMethod: 'Email',
  })
  const contactMethods = ['Email', 'Phone']
  return (
    <>
      <h1>Formul.ai</h1>
      <form className="flex flex-col gap-4">
        <FormField
          formData={formData}
          setFormData={setFormData}
          type="text"
          label="Name"
          name="name"
        />
        <FormField
          formData={formData}
          setFormData={setFormData}
          type="text"
          label="Age"
          name="age"
        />
        <FormField
          formData={formData}
          setFormData={setFormData}
          type="text"
          label="Fav Color"
          name="favoriteColor"
        />
        <div className="flex flex-col gap-2 items-start">
          <label htmlFor="preferredContactMethod">Preferred Contact Method</label>
          <select
            className="border border-red-300 rounded-md p-2 w-full"
            name="preferredContactMethod"
            id="preferredContactMethod"
            onChange={(e) => setFormData({ ...formData, preferredContactMethod: e.target.value })}
          >
            {contactMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
      </form>
    </>
  )
}

export default App
