import { FormData } from '../App.tsx'
import React from 'react'

interface FormFieldProps {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  type: string
  label: string
  name: string
}

export const FormField = ({ formData, setFormData, type, label, name }: FormFieldProps) => {
  return (
    <label className="flex flex-col gap-2 items-start" htmlFor={label}>
      {label}
      <input
        className="border border-red-300 rounded-md p-2"
        id={label}
        type={type}
        value={formData[name as keyof FormData]}
        onChange={(e) => setFormData({ ...formData, [name as keyof FormData]: e.target.value })}
      />
    </label>
  )
}
