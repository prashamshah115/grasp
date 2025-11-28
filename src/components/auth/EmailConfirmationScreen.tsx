/**
 * Email Confirmation Screen
 * Shown when user signs up but hasn't confirmed their email yet
 */

import { useState } from 'react'
import { Mail, RefreshCw, CheckCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { supabase } from '@/lib/supabase'

interface EmailConfirmationScreenProps {
  email: string
  onResend: () => Promise<void>
}

export function EmailConfirmationScreen({ email, onResend }: EmailConfirmationScreenProps) {
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  const handleResend = async () => {
    setIsResending(true)
    setResendSuccess(false)
    try {
      await onResend()
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (error) {
      console.error('Failed to resend confirmation email:', error)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-text-primary">
            Check Your Email
          </h1>
          <p className="text-text-secondary">
            We've sent a confirmation link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-text-tertiary">
            Click the link in the email to activate your account and start learning.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="default"
            onClick={handleResend}
            disabled={isResending || resendSuccess}
            className="w-full"
          >
            {isResending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : resendSuccess ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Email Sent!
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Resend Confirmation Email
              </>
            )}
          </Button>

          {resendSuccess && (
            <p className="text-sm text-success">
              Confirmation email sent! Check your inbox.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-text-tertiary">
            Didn't receive the email? Check your spam folder or try resending.
          </p>
        </div>
      </div>
    </div>
  )
}



