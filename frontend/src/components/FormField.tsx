export const FormField = ({ formData, setFormData, type, label, name }) => {
  return (
    <label className="flex flex-col gap-2 items-start" htmlFor={label}>
      {label}
      <input
        className="border border-red-300 rounded-md p-2"
        name={label}
        type={type}
        value={formData[name]}
        onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
      />
    </label>
  )
}
