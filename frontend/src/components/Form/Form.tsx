import { useState } from 'react'
import { FormField } from './FormField'
import { useFormStatus } from 'react-dom'
import { handleSubmitForm } from '../../api'

export interface FormData {
  name: string
  age: string
  favoriteColor: string
  preferredContactMethod: string
}

export const Form = () => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    favoriteColor: '',
    preferredContactMethod: 'Email',
  })

  const { pending } = useFormStatus()

  const contactMethods = ['Email', 'Phone']

  return (
    <div className="flex flex-col items-center">
      <h1>Formul.ai</h1>
      <form
        className="flex flex-col gap-4 md:w-3/5 w-full"
        onSubmit={(e) => handleSubmitForm(e, formData)}
      >
        <FormField
          formData={formData}
          setFormData={setFormData}
          type="text"
          label="Name"
          name="name"
          required={true}
        />
        <FormField
          formData={formData}
          setFormData={setFormData}
          type="text"
          label="Age"
          name="age"
          required={true}
        />
        <FormField
          formData={formData}
          setFormData={setFormData}
          type="text"
          label="Fav Color"
          name="favoriteColor"
          required={true}
        />
        <div className="flex flex-col gap-2 items-start">
          <label htmlFor="preferredContactMethod">Preferred Contact Method</label>
          <select
            className="border border-zinc-300 rounded-md p-2 w-full"
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
        <button
          disabled={pending}
          className="bg-blue-500 text-white py-2 rounded-xl cursor-pointer"
        >
          Submit
        </button>
      </form>
    </div>
  )
}
