import { useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { Logo, LOGO_SIZE } from '@/components/shared/Logo'
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
  hasAccounts,
  loginAccount,
  PROJECT_ROLES,
  type ProjectAccount,
  type ProjectAccountType,
  type ProjectRole,
  type ProjectSession,
} from '@/services/project-auth-store'

type Flow = 'welcome' | 'create-account' | 'login' | 'hub' | 'create-instance'

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

interface ProjectAuthGateProps {
  onAuthenticated: (session: ProjectSession) => void
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-3.5 py-2.5 text-[13px] text-destructive"
    >
      {message}
    </motion.p>
  )
}

function MiniCanvasPreview() {
  return (
    <div className="relative mt-10 hidden overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:block">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative space-y-2.5">
        <div className="h-8 w-[70%] rounded-lg border border-red-400/30 bg-gradient-to-r from-red-500/20 to-blue-500/10" />
        <div className="ml-6 h-7 w-[55%] rounded-lg border border-blue-400/30 bg-gradient-to-r from-blue-500/15 to-cyan-500/10" />
        <div className="h-8 w-[65%] rounded-lg border border-red-400/20 bg-gradient-to-r from-red-500/15 to-indigo-500/10" />
      </div>
      <p className="relative mt-4 text-[11px] font-medium tracking-wide text-white/50">
        Canvas preview · Agent workflow
      </p>
    </div>
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
    <div className="relative flex min-h-screen overflow-hidden bg-[#07090f] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 15% 20%, rgba(99,102,241,0.28), transparent 55%), radial-gradient(ellipse 50% 45% at 85% 10%, rgba(6,182,212,0.16), transparent 50%), radial-gradient(ellipse 40% 35% at 70% 80%, rgba(139,92,246,0.12), transparent 50%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl lg:grid-cols-[1.05fr_0.95fr]">
        {/* Immersive brand panel */}
        <aside className="relative flex flex-col justify-between px-6 py-10 sm:px-10 lg:min-h-screen lg:px-12 lg:py-14">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label={APP_NAME}>
              <Logo size={LOGO_SIZE} />
              <span className="text-[15px] font-semibold tracking-tight text-white">{APP_NAME}</span>
            </Link>

            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur">
              <Sparkles className="h-3 w-3 text-cyan-300" />
              Enterprise workspace onboarding
            </div>

            <h1 className="mt-5 max-w-md text-[2rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[2.35rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">{subtitle}</p>

            {typeof stepIndex === 'number' && typeof stepCount === 'number' && stepLabels && (
              <ol className="mt-10 hidden space-y-0 lg:block" aria-label={`Step ${stepIndex + 1} of ${stepCount}`}>
                {stepLabels.map((label, index) => {
                  const done = index < stepIndex
                  const active = index === stepIndex
                  return (
                    <li key={label} className="relative flex gap-3.5 pb-7 last:pb-0">
                      {index < stepCount - 1 && (
                        <span
                          className={cn(
                            'absolute left-[13px] top-8 h-[calc(100%-1.5rem)] w-px',
                            done ? 'bg-cyan-300/50' : 'bg-white/10',
                          )}
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                          done && 'border-cyan-300/60 bg-cyan-300 text-slate-950',
                          active && 'border-white/40 bg-white/10 text-white shadow-[0_0_0_4px_rgba(255,255,255,0.04)]',
                          !done && !active && 'border-white/15 bg-transparent text-white/40',
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="pt-1">
                        <span
                          className={cn(
                            'block text-[13px] font-medium',
                            active || done ? 'text-white' : 'text-white/40',
                          )}
                        >
                          {label}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}

            <MiniCanvasPreview />
          </div>

          <div className="mt-10 hidden items-center gap-4 text-[12px] text-white/45 lg:flex">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Local-first security
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span>Account → Instance → Canvas</span>
          </div>
        </aside>

        {/* Form panel */}
        <section className="relative flex items-center px-4 pb-10 sm:px-8 lg:px-10 lg:py-14">
          <div className="w-full">
            {typeof stepIndex === 'number' && typeof stepCount === 'number' && (
              <div className="mb-4 flex items-center gap-2 lg:hidden">
                {Array.from({ length: stepCount }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      index <= stepIndex ? 'bg-cyan-300' : 'bg-white/15',
                    )}
                  />
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
              <AnimatePresence mode="wait">
                <motion.div key={panelKey} {...fadeSlide}>
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>
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
        'group relative flex w-full items-start gap-4 overflow-hidden rounded-xl border px-4 py-4 text-left transition-all duration-300',
        accent === 'primary'
          ? 'border-cyan-300/30 bg-gradient-to-br from-cyan-400/10 via-white/[0.04] to-red-500/10 hover:border-cyan-300/50'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
          accent === 'primary'
            ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
            : 'border-white/10 bg-white/[0.04] text-white/80',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold tracking-tight text-white">{title}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-white/55">{description}</span>
        {meta && <span className="mt-2 block text-[11px] font-medium tracking-wide text-white/40">{meta}</span>}
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/70" />
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
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={backDisabled}
        className="text-white/70 hover:bg-white/5 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={onPrimary}
        className="bg-white text-slate-950 hover:bg-white/90"
      >
        {pending ? 'Please wait…' : primaryLabel}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  )
}

function DarkInput(props: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        'h-11 border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-300/20',
        props.className,
      )}
    />
  )
}

export function ProjectAuthGate({ onAuthenticated }: ProjectAuthGateProps) {
  const accountsExist = useMemo(() => hasAccounts(), [])
  const [flow, setFlow] = useState<Flow>(accountsExist ? 'welcome' : 'create-account')
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
  const [pending, setPending] = useState(false)

  function resetErrors() {
    setError(null)
  }

  function goWelcome() {
    setFlow(accountsExist || account ? 'welcome' : 'create-account')
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
        setError('Password must be at least 6 characters.')
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

  function finishCreateInstance() {
    if (!account) return
    setPending(true)
    resetErrors()
    try {
      const result = createInstanceForAccount(account.id, {
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
        title="Provision your workspace"
        subtitle="Create an account first. Once signed in, open your existing instance or launch a new one."
      >
        <div className="space-y-3">
          <ActionCard
            icon={UserPlus}
            title="Create account"
            description="Register your identity, then provision a company or individual instance."
            onClick={() => {
              setFlow('create-account')
              setStep(0)
              resetErrors()
            }}
            accent="primary"
          />
          <ActionCard
            icon={Lock}
            title="Sign in"
            description="Access your account, then continue to your instance hub."
            onClick={() => {
              setFlow('login')
              resetErrors()
            }}
          />
        </div>
      </WizardShell>
    )
  }

  if (flow === 'login') {
    return (
      <WizardShell
        panelKey="login"
        title="Sign in to continue"
        subtitle="Authenticate your account before opening a workspace instance."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-[12px] font-medium text-white/70">
              Email
            </Label>
            <DarkInput
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
            <Label htmlFor="login-password" className="text-[12px] font-medium text-white/70">
              Password
            </Label>
            <DarkInput
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>
          <FieldError message={error} />
          <FooterActions
            onBack={goWelcome}
            primaryLabel="Continue to hub"
            pending={pending}
            onPrimary={() => void finishLogin()}
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
        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[11px] font-medium tracking-wide text-white/40 uppercase">Signed in</p>
          <p className="mt-1 text-[13px] font-medium text-white">{account.email}</p>
          <p className="mt-0.5 text-[12px] text-white/45">
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

        <div className="mt-6 text-center text-[13px] text-white/45">
          <button
            type="button"
            className="font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
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
          <p className="mb-5 text-[12px] font-medium tracking-wide text-white/45 lg:hidden">
            Step {step + 1} of {ACCOUNT_STEPS.length} · {current.label}
          </p>

          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-[12px] font-medium text-white/70">
                  Full name
                </Label>
                <DarkInput
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoFocus
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-[12px] font-medium text-white/70">Role</Label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_ROLES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setRole(item.value)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all',
                        role === item.value
                          ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100'
                          : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/80',
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
                <Label htmlFor="email" className="text-[12px] font-medium text-white/70">
                  Work email
                </Label>
                <DarkInput
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
                  <Label htmlFor="password" className="text-[12px] font-medium text-white/70">
                    Password
                  </Label>
                  <DarkInput
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[12px] font-medium text-white/70">
                    Confirm
                  </Label>
                  <DarkInput
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
            <dl className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {(
                [
                  ['Name', fullName.trim() || '—'],
                  ['Role', PROJECT_ROLES.find((item) => item.value === role)?.label ?? role],
                  ['Email', email.trim() || '—'],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3.5 last:border-b-0"
                >
                  <dt className="text-[12px] text-white/45">{label}</dt>
                  <dd className="truncate text-right text-[13px] font-medium text-white">{value}</dd>
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

          {accountsExist && step === 0 && (
            <p className="mt-4 text-center text-[13px] text-white/45">
              Already registered?{' '}
              <button
                type="button"
                className="font-medium text-white/85 underline-offset-4 hover:underline"
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
        <p className="mb-5 text-[12px] font-medium tracking-wide text-white/45 lg:hidden">
          Step {step + 1} of {INSTANCE_STEPS.length} · {current.label}
        </p>

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
                      ? 'border-cyan-300/40 bg-cyan-300/[0.08] shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl border',
                      selected
                        ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
                        : 'border-white/10 bg-white/[0.04] text-white/70',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
                      {label}
                      {selected && <Check className="h-3.5 w-3.5 text-cyan-300" />}
                    </span>
                    <span className="mt-1.5 block text-[12px] leading-relaxed text-white/50">
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
            <Label htmlFor="instanceName" className="text-[12px] font-medium text-white/70">
              {accountType === 'company' ? 'Company name' : 'Instance name'}
            </Label>
            <DarkInput
              id="instanceName"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder={accountType === 'company' ? 'Acme Robotics' : 'My workspace'}
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <dl className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {(
              [
                ['Account', account?.email ?? '—'],
                ['Type', accountType === 'company' ? 'Company' : 'Individual'],
                ['Instance', instanceName.trim() || '—'],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3.5 last:border-b-0"
              >
                <dt className="text-[12px] text-white/45">{label}</dt>
                <dd className="truncate text-right text-[13px] font-medium text-white">{value}</dd>
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
