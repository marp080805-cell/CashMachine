'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import { Brain, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

type LoginForm = z.infer<typeof loginSchema>

interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3011'
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const err = (await response.json()) as { error: string }
        throw new Error(err.error ?? 'Erro ao fazer login')
      }

      const result = (await response.json()) as LoginResponse
      setAuth(result.user, result.accessToken, result.refreshToken)
      router.replace('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credenciais inválidas')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand header — outside the card */}
      <div className="flex flex-col items-center mb-8">
        {/* Brain icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm mb-4 shadow-lg">
          <Brain className="h-8 w-8 text-white" />
        </div>

        {/* Platform name */}
        <h1 className="text-4xl font-bold text-white tracking-tight leading-none">
          CashMind
        </h1>

        {/* Signature "by logo" */}
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-white/50 text-xs font-normal tracking-wide">by</span>
          <Image
            src="/logo-branco.png"
            alt="Seu Resultado"
            width={80}
            height={18}
            className="h-[14px] w-auto object-contain opacity-60"
            priority
          />
        </div>
      </div>

      {/* Login card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl px-8 py-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Plataforma Comercial B2B
          </p>
          <h2 className="text-xl font-semibold text-foreground mt-1">
            Entrar na plataforma
          </h2>
        </div>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full mt-2" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
