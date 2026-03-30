'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
}

interface FormStyling {
  backgroundColor?: string
  buttonColor?: string
  textColor?: string
}

interface PublicForm {
  id: string
  name: string
  slug: string
  fields: FormField[]
  redirectUrl?: string | null
  styling?: FormStyling | null
}

export default function PublicFormPage() {
  const params = useParams()
  const slug = params.slug as string
  const [form, setForm] = useState<PublicForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3011'
    fetch(`${apiUrl}/forms/${slug}/public`)
      .then((res) => {
        if (!res.ok) throw new Error('Formulário não encontrado')
        return res.json() as Promise<PublicForm>
      })
      .then((data) => {
        setForm(data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar formulário')
      })
      .finally(() => setLoading(false))
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    // Validate required fields
    for (const field of form.fields) {
      if (field.required && !values[field.id]) {
        alert(`O campo "${field.label}" é obrigatório.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3011'

      // Build payload: values keyed by field.id for storage
      // Plus extract name/email/phone for contact creation
      const payload: Record<string, string> = {}
      let firstTextFieldId: string | undefined

      for (const field of form.fields) {
        const value = values[field.id] ?? ''
        // Store by field id
        payload[field.id] = value
        // Map standard types to contact fields
        if (field.type === 'email') payload.email = value
        else if (field.type === 'phone') payload.phone = value
        else if (field.type === 'text' && !firstTextFieldId) firstTextFieldId = field.id
      }

      // First text field is treated as name
      if (firstTextFieldId) payload.name = values[firstTextFieldId] ?? ''

      const res = await fetch(`${apiUrl}/forms/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Erro ao enviar formulário')
      }

      const result = await res.json() as { redirectUrl?: string | null }

      if (result.redirectUrl ?? form.redirectUrl) {
        window.location.href = (result.redirectUrl ?? form.redirectUrl) as string
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ocorreu um erro ao enviar o formulário. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const bg = form?.styling?.backgroundColor ?? '#f9fafb'
  const btnColor = form?.styling?.buttonColor ?? '#2563eb'
  const textColor = form?.styling?.textColor ?? '#111827'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <p className="text-sm" style={{ color: textColor }}>Carregando formulário...</p>
      </div>
    )
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-700 font-medium">Formulário não encontrado</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="text-center max-w-sm p-8">
          <div className="text-4xl mb-4">✅</div>
          <p className="font-semibold text-lg" style={{ color: textColor }}>Obrigado!</p>
          <p className="text-sm mt-2" style={{ color: textColor, opacity: 0.7 }}>Entraremos em contato em breve.</p>
        </div>
      </div>
    )
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white'

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ backgroundColor: bg }}>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <h1 className="text-xl font-semibold mb-6" style={{ color: textColor }}>{form.name}</h1>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {form.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-sm font-medium" style={{ color: textColor }}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    required={field.required}
                    placeholder={field.placeholder}
                    value={values[field.id] ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    rows={4}
                    className={`${inputClass} resize-none`}
                    style={{ '--tw-ring-color': btnColor } as React.CSSProperties}
                  />
                ) : field.type === 'select' ? (
                  <select
                    required={field.required}
                    value={values[field.id] ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{field.placeholder ?? 'Selecione uma opção'}</option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      field.type === 'email' ? 'email'
                      : field.type === 'phone' ? 'tel'
                      : field.type === 'number' ? 'number'
                      : field.type === 'date' ? 'date'
                      : 'text'
                    }
                    required={field.required}
                    placeholder={field.placeholder}
                    value={values[field.id] ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>
            ))}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-opacity disabled:opacity-50"
                style={{ backgroundColor: btnColor }}
              >
                {submitting ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
