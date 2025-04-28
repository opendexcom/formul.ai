import { useState } from 'react'

export const Form = () => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    favoriteColor: '',
    preferredContactMethod: 'Email',
  })

  return (
    <div>
      <form className="flex flex-col gap-2 items-start">
        <div className="flex flex-col gap-2 items-start">
          <label htmlFor="">Name</label>
          <input
            className="border border-black"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <input
          type="number"
          value={formData.age}
          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
        />

        <input
          type="text"
          value={formData.age}
          onChange={(e) => setFormData({ ...formData, favoriteColor: e.target.value })}
        />
        <select
          onChange={(e) => setFormData({ ...formData, preferredContactMethod: e.target.value })}
        >
          <option value="email">Email</option>
          <option value="blue">blue</option>
        </select>
      </form>
    </div>
  )
}
