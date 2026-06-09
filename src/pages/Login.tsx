import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button, Input, Alert } from '../components/ui'
import { Store, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const { signIn, signUp, loading, user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    try {
      if (isSignUp) {
        await signUp(email, password)
        toast.success('Account created! Setting up your shops...')
      } else {
        await signIn(email, password)
        toast.success('Welcome back!')
      }
      navigate('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      setError(message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Nandarani POS</h1>
          <p className="text-blue-200 mt-1 text-sm">Premium Garment Business Management</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onClose={() => setError('')} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@example.com"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              suffix={
                <button type="button" onClick={() => setShowPassword(v => !v)} className="text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              required
            />

            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(v => !v); setError('') }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Shops are automatically created for:<br />
              <span className="font-medium">NANDARANI BASTRALAY (NB)</span> &amp; <span className="font-medium">NEW NANDARANI BASTRALAY (NBN)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
