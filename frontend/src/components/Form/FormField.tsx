import { FormData } from './SignupForm'

interface FormFieldProps {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  type: string
  label: string
  name: string
  required: boolean
}

export const FormField = ({
  formData,
  setFormData,
  type,
  label,
  name,
  required,
}: FormFieldProps) => {
  return (
    <label className="flex flex-col gap-2 items-start" htmlFor={label}>
      {label}
      <input
        className="border border-zinc-300 rounded-md p-2 w-full"
        id={label}
        type={type}
        required={required}
        value={formData[name as keyof FormData]}
        onChange={(e) => setFormData({ ...formData, [name as keyof FormData]: e.target.value })}
      />
    </label>
  )
}
