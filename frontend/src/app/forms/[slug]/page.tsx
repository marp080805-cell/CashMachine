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

interface PublicForm {
  id: string
  name: string
  slug: string
  fields: FormField[]
  redirectUrl?: string
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
      const res = await fetch(`${apiUrl}/forms/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })

      if (!res.ok) throw new Error('Erro ao enviar formulário')

      if (form.redirectUrl) {
        window.location.href = form.redirectUrl
      } else {
        setSubmitted(true)
      }
    } catch {
      alert('Ocorreu um erro ao enviar o formulário. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Carregando formulário...</p>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm p-8">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-gray-800 font-semibold text-lg">Obrigado!</p>
          <p className="text-gray-500 text-sm mt-2">Entraremos em contato em breve.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">{form.name}</h1>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {form.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                ) : field.type === 'select' ? (
                  <select
                    required={field.required}
                    value={values[field.id] ?? ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>
            ))}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
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
