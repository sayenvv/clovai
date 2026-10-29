import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Check,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { APP_NAME } from '@/constants'
import { cn } from '@/utils/cn'
import {
  accountHasInstance,
  createAccount,
  createInstanceForAccount,
  enterInstance,
  loginAccount,
  loginWithGoogle,
  PROJECT_ROLES,
  type ProjectAccount,
  type ProjectAccountType,
  type ProjectRole,
  type ProjectSession,
} from '@/services/project-auth-store'

/*
 * The sign-in gate in the website's style: always light, one brand green, hairlines. A brand panel on the left
 * (it stays put between steps) and the form on the right, which slides between steps.
 */

type Flow = 'welcome' | 'create-account' | 'login' | 'reset-password' | 'hub' | 'create-instance'

const ACCOUNT_STEPS = [
  { label: 'Profile', title: 'Create your account', subtitle: 'Tell us who you are before provisioning a workspace.' },
  { label: 'Credentials', title: 'Secure access', subtitle: 'These credentials unlock your account on this device.' },
  { label: 'Confirm', title: 'Review account', subtitle: 'Confirm details, then continue to your instance hub.' },
] as const

const INSTANCE_STEPS = [
  { label: 'Type', title: 'Instance type', subtitle: 'Choose the operating model for this workspace.' },
  { label: 'Identity', title: 'Instance identity', subtitle: 'Give the workspace a clear, lasting name.' },
  { label: 'Launch', title: 'Launch instance', subtitle: 'Confirm and open your dedicated canvas environment.' },
] as const

const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
}

// The website's palette, fixed here so the gate looks the same whatever the workspace theme is
const INK = 'text-[#16130F]'
const SOFT = 'text-[#3A3530]'
const MUTED = 'text-[#6B655E]'
const FAINT = 'text-[#9A938B]'
const LINE = 'border-black/[0.08]'
const BRAND_LINK = 'font-medium text-[#163D2D] underline-offset-4 hover:underline'

interface ProjectAuthGateProps {
  onAuthenticated: (session: ProjectSession) => void
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700"
      role="alert"
    >
      {message}
    </motion.p>
  )
}

const DOTS = { backgroundImage: 'radial-gradient(rgba(23,23,23,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }

/** A small live canvas: three steps, a run's light travelling between them, then the run's result. */
function AuthCanvasPreview() {
  const nodes = [
    { label: 'Lead Intake', meta: 'Agent' },
    { label: 'Email Writer', meta: 'Agent', fresh: true },
    { label: 'Approval', meta: 'Manager', approval: true },
  ]
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(23,23,23,0.08),0_20px_48px_-28px_rgba(23,23,23,0.4)]">
      <div className={cn('flex items-center gap-2 border-b px-4 py-2.5', LINE)}>
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
          <span className="h-2 w-2 rounded-full bg-black/10" />
        </span>
        <span className={cn('text-[12px]', MUTED)}>Lead follow-up</span>
      </div>
      <div className="relative bg-[#FAFAF9] px-5 py-8" style={DOTS}>
        <div className="relative flex items-center justify-between gap-3">
          {/* The connector behind the steps, with a run's light moving along it */}
          <span className="absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-black/20" aria-hidden />
          <motion.span
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#EB6115] shadow-[0_0_10px_rgba(235,97,21,0.7)]"
            initial={{ left: '12%' }}
            animate={{ left: ['12%', '50%', '86%'] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
            aria-hidden
          />
          {nodes.map((node, index) => (
            <motion.div
              key={node.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.12, duration: 0.5 }}
              className={cn(
                'relative flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-2.5 py-2',
                node.fresh
                  ? 'shadow-[0_0_0_2px_#16A34A,0_0_0_5px_rgba(22,163,74,0.12)]'
                  : 'shadow-[0_0_0_1px_rgba(23,23,23,0.1),0_4px_10px_-6px_rgba(23,23,23,0.3)]',
              )}
            >
              {node.fresh && (
                <span className="absolute -top-2 left-2 rounded-full bg-[#16A34A] px-1.5 text-[9px] font-semibold leading-4 text-white">
                  New
                </span>
              )}
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                  node.approval ? 'bg-amber-500/12 text-amber-600' : 'bg-[#EB6115]/10 text-[#C9500C]',
                )}
              >
                {node.approval ? <ShieldCheck className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-[11.5px] font-semibold', INK)}>{node.label}</span>
                <span className={cn('block text-[10px]', MUTED)}>{node.meta}</span>
              </span>
            </motion.div>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11.5px] shadow-[0_0_0_1px_rgba(23,23,23,0.08)]">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#1BA672] text-white">
              <Check className="h-2.5 w-2.5" strokeWidth={4} />
            </span>
            <span className={cn('font-medium', INK)}>Run completed</span>
            <span className={cn('font-mono', MUTED)}>3.2s · 3.6k tokens</span>
          </span>
        </div>
      </div>
    </div>
  )
}

const PROOF = ['Built on Microsoft Agent Framework', 'Review every AI change before it lands', 'Approvals, traces and run limits built in']

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-black/[0.12] bg-white text-[14px] font-medium transition-colors hover:bg-[#FAFAF9] disabled:opacity-60',
        INK,
      )}
    >
      <GoogleMark />
      Continue with Google
    </button>
  )
}

function OrDivider() {
  return (
    <div className={cn('flex items-center gap-3 text-[12px]', FAINT)}>
      <span className={cn('h-px flex-1 border-t', LINE)} />
      or
      <span className={cn('h-px flex-1 border-t', LINE)} />
    </div>
  )
}

/** The step a wizard is on: numbered dots joined by a line, the current one in the brand green. */
function Stepper({ index, labels }: { index: number; labels: readonly string[] }) {
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label={`Step ${index + 1} of ${labels.length}`}>
      {labels.map((label, i) => {
        const done = i < index
        const active = i === index
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                done && 'bg-[#163D2D] text-white',
                active && 'bg-[#163D2D] text-white shadow-[0_0_0_4px_rgba(22,61,45,0.12)]',
                !done && !active && 'bg-white text-[#9A938B] shadow-[0_0_0_1px_rgba(23,23,23,0.12)]',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('truncate text-[12.5px] font-medium', active || done ? INK : FAINT)}>{label}</span>
            {i < labels.length - 1 && <span className={cn('h-px min-w-3 flex-1', done ? 'bg-[#163D2D]' : 'bg-black/10')} />}
          </li>
        )
      })}
    </ol>
  )
}

function WizardShell({
  children,
  title,
  subtitle,
  stepIndex,
  stepCount,
  stepLabels,
  panelKey,
}: {
  children: ReactNode
  title: string
  subtitle: string
  stepIndex?: number
  stepCount?: number
  stepLabels?: readonly string[]
  panelKey: string
}) {
  return (
    <div className={cn('flex min-h-screen bg-white antialiased', INK)}>
      {/* Brand panel */}
      <aside className={cn('relative hidden w-[46%] max-w-[46rem] flex-col justify-between overflow-hidden border-r bg-[#FAFAF9] px-12 py-10 lg:flex xl:px-16', LINE)}>
        <div className="pointer-events-none absolute inset-0" style={DOTS} aria-hidden />
        <Link to="/" className="relative inline-flex w-fit items-center gap-2.5" aria-label={APP_NAME}>
          <img src="/brand/mark-darkgreen.svg" alt="" className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
        </Link>

        <div className="relative mx-auto w-full max-w-[30rem]">
          <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.03em]">
            Build AI agent workflows <span className="text-[#9A938B]">you can see, review and trust.</span>
          </h2>
          <div className="mt-9">
            <AuthCanvasPreview />
          </div>
          <ul className="mt-9 space-y-2.5">
            {PROOF.map((item) => (
              <li key={item} className={cn('flex items-center gap-2.5 text-[14px]', SOFT)}>
                <Check className="h-4 w-4 text-[#163D2D]" strokeWidth={2.5} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className={cn('relative flex items-center gap-1.5 text-[12.5px]', MUTED)}>
          <ShieldCheck className="h-3.5 w-3.5" />
          Local-first security · Account → Instance → Canvas
        </p>
      </aside>

      {/* Form */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className={cn('flex h-16 items-center border-b px-5 lg:hidden', LINE)}>
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label={APP_NAME}>
            <img src="/brand/mark-darkgreen.svg" alt="" className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-[25rem]">
            <AnimatePresence mode="wait">
              <motion.div key={panelKey} {...fadeSlide}>
                {typeof stepIndex === 'number' && typeof stepCount === 'number' && stepLabels && (
                  <Stepper index={stepIndex} labels={stepLabels} />
                )}
                <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
                <p className={cn('mt-2 text-[15px] leading-relaxed', MUTED)}>{subtitle}</p>
                <div className="mt-8">{children}</div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  )
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  accent = 'default',
  meta,
}: {
  icon: typeof Lock
  title: string
  description: string
  onClick: () => void
  accent?: 'default' | 'primary'
  meta?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-start gap-3.5 rounded-xl border bg-white px-4 py-4 text-left transition-[border-color,background-color,box-shadow] duration-200',
        accent === 'primary'
          ? 'border-[#163D2D]/40 shadow-[0_0_0_3px_rgba(22,61,45,0.06)] hover:border-[#163D2D]'
          : 'border-black/[0.1] hover:border-black/25 hover:bg-[#FAFAF9]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          accent === 'primary' ? 'bg-[#163D2D] text-white' : 'bg-[#F4F4F2] text-[#3A3530] ring-1 ring-inset ring-black/[0.06]',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[14.5px] font-semibold tracking-tight', INK)}>{title}</span>
        <span className={cn('mt-0.5 block text-[13px] leading-relaxed', MUTED)}>{description}</span>
        {meta && <span className={cn('mt-2 block text-[12px] font-medium', FAINT)}>{meta}</span>}
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#9A938B] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#16130F]" />
    </button>
  )
}

function FooterActions({
  onBack,
  backDisabled,
  primaryLabel,
  onPrimary,
  pending,
}: {
  onBack: () => void
  backDisabled?: boolean
  primaryLabel: string
  onPrimary: () => void
  pending?: boolean
}) {
  return (
    <div className={cn('mt-8 flex items-center justify-between gap-3 border-t pt-5', LINE)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={backDisabled}
        className="text-[#6B655E] hover:bg-black/[0.04] hover:text-[#16130F]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={onPrimary}
        className="h-10 rounded-lg bg-[#163D2D] px-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#0B2419]"
      >
        {pending ? 'Please wait…' : primaryLabel}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  )
}

function FieldInput(props: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        'h-11 rounded-lg border-black/[0.12] bg-white text-[14px] text-[#16130F] placeholder:text-[#9A938B] focus-visible:border-[#163D2D]/60 focus-visible:ring-[#163D2D]/15',
        props.className,
      )}
    />
  )
}

export function ProjectAuthGate({ onAuthenticated }: ProjectAuthGateProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [flow, setFlow] = useState<Flow>('welcome')
  const [step, setStep] = useState(0)
  const [account, setAccount] = useState<ProjectAccount | null>(null)

  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<ProjectRole>('developer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [accountType, setAccountType] = useState<ProjectAccountType>('company')
  const [instanceName, setInstanceName] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const auth = searchParams.get('auth')
    if (!auth) return
    if (auth === 'login') {
      setFlow('login')
      setStep(0)
      setError(null)
    } else if (auth === 'create' || auth === 'signup') {
      setFlow('create-account')
      setStep(0)
      setError(null)
    } else if (auth === 'reset') {
      setFlow('reset-password')
      setStep(0)
      setError(null)
    }
    const next = new URLSearchParams(searchParams)
    next.delete('auth')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function resetErrors() {
    setError(null)
    setNotice(null)
  }

  function goWelcome() {
    setFlow('welcome')
    setStep(0)
    resetErrors()
  }

  function goHub(nextAccount: ProjectAccount) {
    setAccount(nextAccount)
    setFlow('hub')
    setStep(0)
    resetErrors()
  }

  function validateAccountStep(): boolean {
    resetErrors()
    if (step === 0 && !fullName.trim()) {
      setError('Enter your full name.')
      return false
    }
    if (step === 1) {
      if (!email.trim() || !email.includes('@')) {
        setError('Enter a valid email address.')
        return false
      }
      if (password.length < 6) {
        setError('Password must be at least 8 characters.')
        return false
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return false
      }
    }
    return true
  }

  function validateInstanceStep(): boolean {
    resetErrors()
    if (step === 1 && !instanceName.trim()) {
      setError(accountType === 'company' ? 'Enter a company name.' : 'Enter an instance name.')
      return false
    }
    return true
  }

  async function finishCreateAccount() {
    setPending(true)
    resetErrors()
    try {
      const result = await createAccount({ fullName, role, email, password })
      if ('error' in result) {
        setError(result.error)
        return
      }
      goHub(result.account)
    } catch {
      setError('Could not create account. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function finishLogin() {
    setPending(true)
    resetErrors()
    try {
      const result = await loginAccount(email, password)
      if ('error' in result) {
        setError(result.error)
        return
      }
      goHub(result.account)
    } catch {
      setError('Could not sign in. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function finishGoogle() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
    if (!clientId) {
      setError('Google sign-in is not configured.')
      return
    }
    setPending(true)
    resetErrors()
    try {
      const code = await requestGoogleAuthCode(clientId)
      const result = await loginWithGoogle(code)
      if ('error' in result) {
        setError(result.error)
        return
      }
      goHub(result.account)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign in with Google.')
    } finally {
      setPending(false)
    }
  }



  function openInstance() {
    if (!account) return
    resetErrors()
    const result = enterInstance(account.id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onAuthenticated(result.session)
  }

  async function finishCreateInstance() {
    if (!account) return
    setPending(true)
    resetErrors()
    try {
      const result = await createInstanceForAccount(account.id, {
        accountType,
        displayName: instanceName,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      onAuthenticated(result.session)
    } finally {
      setPending(false)
    }
  }

  if (flow === 'welcome') {
    return (
      <WizardShell
        panelKey="welcome"
        title={`Welcome to ${APP_NAME}`}
        subtitle="Sign in to your workspace, or create an account to set one up."
      >
        <div className="space-y-3">
          <ActionCard
            icon={Lock}
            title="Sign in"
            description="Access your account, then continue to your instance hub."
            onClick={() => {
              setFlow('login')
              resetErrors()
            }}
            accent="primary"
          />
          <ActionCard
            icon={UserPlus}
            title="Create account"
            description="Register your identity, then provision a company or individual instance."
            onClick={() => {
              setFlow('create-account')
              setStep(0)
              resetErrors()
            }}
          />
          <div className="pt-2">
            <OrDivider />
          </div>
          <GoogleButton onClick={() => void finishGoogle()} disabled={pending} />
          <FieldError message={error} />
        </div>
      </WizardShell>
    )
  }

  if (flow === 'login') {
    return (
      <WizardShell
        panelKey="login"
        title="Sign in"
        subtitle="Welcome back. Sign in to open your workspace."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-[13px] font-medium text-[#3A3530]">
              Email
            </Label>
            <FieldInput
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-[13px] font-medium text-[#3A3530]">
              Password
            </Label>
            <FieldInput
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="text-[13px] font-medium text-[#6B655E] underline-offset-4 hover:text-[#16130F] hover:underline"
              onClick={() => {
                setFlow('reset-password')
                setPassword('')
                setConfirmPassword('')
                resetErrors()
              }}
            >
              Forgot password?
            </button>
          </div>
          {notice && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
              {notice}
            </p>
          )}
          <FieldError message={error} />
          <FooterActions
            onBack={goWelcome}
            primaryLabel="Continue to hub"
            pending={pending}
            onPrimary={() => void finishLogin()}
          />
          <OrDivider />
          <GoogleButton onClick={() => void finishGoogle()} disabled={pending} />
          <p className="mt-6 text-center text-[13.5px] text-[#6B655E]">
            New here?{' '}
            <button
              type="button"
              className={BRAND_LINK}
              onClick={() => {
                setFlow('create-account')
                setStep(0)
                resetErrors()
              }}
            >
              Create account
            </button>
          </p>
        </div>
      </WizardShell>
    )
  }

  if (flow === 'reset-password') {
    return (
      <WizardShell
        panelKey="reset-password"
        title="Reset password"
        subtitle="Forgot your password?"
      >
        <div className="space-y-4">
          <p className="text-[14px] leading-relaxed text-[#3A3530]">
            Password reset by email isn&apos;t available yet. Ask an admin to reset your password, or sign in with
            Google if your account uses it. Once you&apos;re signed in you can change your password from Account →
            Security.
          </p>
          <FooterActions
            onBack={() => {
              setFlow('login')
              resetErrors()
            }}
            primaryLabel="Back to sign in"
            pending={false}
            onPrimary={() => {
              setFlow('login')
              resetErrors()
            }}
          />
        </div>
      </WizardShell>
    )
  }

  if (flow === 'hub' && account) {
    const hasInstance = accountHasInstance(account)
    return (
      <WizardShell
        panelKey="hub"
        title={`Welcome back, ${account.fullName.split(' ')[0]}`}
        subtitle={
          hasInstance
            ? 'Your instance is provisioned. Enter the canvas environment when ready.'
            : 'Account verified. Create an instance to unlock your dedicated workspace.'
        }
      >
        <div className="mb-5 rounded-xl border border-black/[0.08] bg-[#FAFAF9] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#9A938B]">Signed in</p>
          <p className="mt-1 text-[14px] font-medium text-[#16130F]">{account.email}</p>
          <p className="mt-0.5 text-[12.5px] text-[#6B655E]">
            {PROJECT_ROLES.find((item) => item.value === account.role)?.label ?? account.role}
          </p>
        </div>

        <div className="space-y-3">
          {hasInstance ? (
            <ActionCard
              icon={LayoutDashboard}
              title="Go to your instance"
              description="Open your existing workspace and continue building agent workflows."
              meta={`${account.instance?.displayName} · ${account.instance?.accountType === 'company' ? 'Company' : 'Individual'}`}
              onClick={openInstance}
              accent="primary"
            />
          ) : (
            <ActionCard
              icon={Building2}
              title="Create your instance"
              description="Provision a company or individual workspace for this account."
              onClick={() => {
                setFlow('create-instance')
                setStep(0)
                resetErrors()
              }}
              accent="primary"
            />
          )}
        </div>

        <FieldError message={error} />

        <div className="mt-6 text-center text-[13.5px] text-[#6B655E]">
          <button
            type="button"
            className={BRAND_LINK}
            onClick={() => {
              setAccount(null)
              goWelcome()
            }}
          >
            Use another account
          </button>
        </div>
      </WizardShell>
    )
  }

  if (flow === 'create-account') {
    const current = ACCOUNT_STEPS[step]
    return (
      <WizardShell
        panelKey={`account-${step}`}
        title={current.title}
        subtitle={current.subtitle}
        stepIndex={step}
        stepCount={ACCOUNT_STEPS.length}
        stepLabels={ACCOUNT_STEPS.map((item) => item.label)}
      >
        <div>

          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-[13px] font-medium text-[#3A3530]">
                  Full name
                </Label>
                <FieldInput
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoFocus
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-[13px] font-medium text-[#3A3530]">Role</Label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_ROLES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setRole(item.value)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                        role === item.value
                          ? 'border-[#163D2D] bg-[#163D2D] text-white'
                          : 'border-black/[0.12] bg-white text-[#3A3530] hover:border-black/25',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-medium text-[#3A3530]">
                  Work email
                </Label>
                <FieldInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoFocus
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[13px] font-medium text-[#3A3530]">
                    Password
                  </Label>
                  <FieldInput
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#3A3530]">
                    Confirm
                  </Label>
                  <FieldInput
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <dl className="overflow-hidden rounded-xl border border-black/[0.08] bg-[#FAFAF9]">
              {(
                [
                  ['Name', fullName.trim() || '—'],
                  ['Role', PROJECT_ROLES.find((item) => item.value === role)?.label ?? role],
                  ['Email', email.trim() || '—'],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-black/[0.08] px-4 py-3.5 last:border-b-0"
                >
                  <dt className="text-[13px] text-[#6B655E]">{label}</dt>
                  <dd className="truncate text-right text-[13.5px] font-medium text-[#16130F]">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-5">
            <FieldError message={error} />
          </div>

          <FooterActions
            onBack={() => {
              resetErrors()
              if (step === 0) {
                goWelcome()
                return
              }
              setStep((s) => Math.max(0, s - 1))
            }}
            primaryLabel={step < ACCOUNT_STEPS.length - 1 ? 'Continue' : 'Create account'}
            pending={pending && step === ACCOUNT_STEPS.length - 1}
            onPrimary={() => {
              if (step < ACCOUNT_STEPS.length - 1) {
                if (!validateAccountStep()) return
                setStep((s) => s + 1)
                return
              }
              void finishCreateAccount()
            }}
          />

          {step === 0 && (
            <p className="mt-6 text-center text-[13.5px] text-[#6B655E]">
              Already have an account?{' '}
              <button
                type="button"
                className={BRAND_LINK}
                onClick={() => {
                  setFlow('login')
                  resetErrors()
                }}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </WizardShell>
    )
  }

  const current = INSTANCE_STEPS[step]
  return (
    <WizardShell
      panelKey={`instance-${step}`}
      title={current.title}
      subtitle={current.subtitle}
      stepIndex={step}
      stepCount={INSTANCE_STEPS.length}
      stepLabels={INSTANCE_STEPS.map((item) => item.label)}
    >
      <div>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: 'company' as const,
                  label: 'Company',
                  description: 'Shared environment for teams and organizations.',
                  icon: Building2,
                },
                {
                  id: 'individual' as const,
                  label: 'Individual',
                  description: 'Private workspace for personal or learning use.',
                  icon: UserRound,
                },
              ] as const
            ).map(({ id, label, description, icon: Icon }) => {
              const selected = accountType === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAccountType(id)}
                  className={cn(
                    'flex h-full flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all duration-300',
                    selected
                      ? 'border-[#163D2D] bg-white shadow-[0_0_0_3px_rgba(22,61,45,0.08)]'
                      : 'border-black/[0.1] bg-white hover:border-black/25',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl border',
                      selected
                        ? 'border-[#163D2D] bg-[#163D2D] text-white'
                        : 'border-black/[0.08] bg-[#F4F4F2] text-[#3A3530]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-[14.5px] font-semibold text-[#16130F]">
                      {label}
                      {selected && <Check className="h-3.5 w-3.5 text-[#163D2D]" strokeWidth={3} />}
                    </span>
                    <span className="mt-1.5 block text-[13px] leading-relaxed text-[#6B655E]">
                      {description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <Label htmlFor="instanceName" className="text-[13px] font-medium text-[#3A3530]">
              {accountType === 'company' ? 'Company name' : 'Instance name'}
            </Label>
            <FieldInput
              id="instanceName"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder={accountType === 'company' ? 'Acme Robotics' : 'My workspace'}
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <dl className="overflow-hidden rounded-xl border border-black/[0.08] bg-[#FAFAF9]">
            {(
              [
                ['Account', account?.email ?? '—'],
                ['Type', accountType === 'company' ? 'Company' : 'Individual'],
                ['Instance', instanceName.trim() || '—'],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-black/[0.08] px-4 py-3.5 last:border-b-0"
              >
                <dt className="text-[13px] text-[#6B655E]">{label}</dt>
                <dd className="truncate text-right text-[13.5px] font-medium text-[#16130F]">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5">
          <FieldError message={error} />
        </div>

        <FooterActions
          onBack={() => {
            resetErrors()
            if (step === 0) {
              if (account) goHub(account)
              else goWelcome()
              return
            }
            setStep((s) => Math.max(0, s - 1))
          }}
          primaryLabel={step < INSTANCE_STEPS.length - 1 ? 'Continue' : 'Launch instance'}
          pending={pending && step === INSTANCE_STEPS.length - 1}
          onPrimary={() => {
            if (step < INSTANCE_STEPS.length - 1) {
              if (!validateInstanceStep()) return
              setStep((s) => s + 1)
              return
            }
            finishCreateInstance()
          }}
        />
      </div>
    </WizardShell>
  )
}

function requestGoogleAuthCode(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const start = () => {
      const oauth = (window as GoogleWindow).google?.accounts?.oauth2
      if (!oauth) {
        reject(new Error('Google sign-in failed to load.'))
        return
      }
      const client = oauth.initCodeClient({
        client_id: clientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        callback: (response) => {
          if (response.error) {
            reject(new Error('Google sign-in was cancelled.'))
            return
          }
          if (!response.code) {
            reject(new Error('Google did not return a sign-in code.'))
            return
          }
          resolve(response.code)
        },
      })
      client.requestCode()
    }
    if ((window as GoogleWindow).google?.accounts?.oauth2) {
      start()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = start
    script.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(script)
  })
}

interface GoogleWindow extends Window {
  google?: {
    accounts: {
      oauth2: {
        initCodeClient: (config: {
          client_id: string
          scope: string
          ux_mode: 'popup'
          callback: (response: { code?: string; error?: string }) => void
        }) => { requestCode: () => void }
      }
    }
  }
}
