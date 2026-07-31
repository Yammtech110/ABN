import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import {
  Mail,
  Phone,
  User,
  LogIn,
  UserPlus,
  Lock,
  Loader2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';
import { SUPPORT_MAILTO } from '../data/legalContent';
import { userFacingError } from '../utils/userFacingError';

type AuthMode = 'signin' | 'register' | 'verify' | 'forgot' | 'reset-code' | 'reset-choice';

const fieldClass =
  'w-full pl-[3.35rem] pr-11 py-3.5 rounded-2xl bg-[#1E1915] border border-[#2B231D] focus:border-[#F08C32] outline-none ring-0 focus:ring-0 text-[15px] text-white placeholder:text-[#8E8E8E] transition-colors';

const labelClass =
  'block text-[11px] font-extrabold tracking-wide text-white mb-2 uppercase';

const primaryBtn =
  'w-full py-3.5 mt-2 rounded-2xl bg-[#FF9E47] text-white font-black text-sm tracking-wide hover:bg-[#F08C32] active:scale-[0.985] transition-all disabled:opacity-55 flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(240,140,50,0.28)]';

const FieldIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[#FF9E47]/15 flex items-center justify-center pointer-events-none">
    {children}
  </span>
);

/** Charcoal auth gateway — mockup layout, ABN theme colors */
export const AuthScreen: React.FC = () => {
  const {
    language,
    apiLogin,
    registerAccount,
    verifyEmailCode,
    resendVerificationCode,
    requestPasswordReset,
    verifyResetCode,
    completePasswordReset,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setName('');
    setVerifyCode('');
    setError('');
    setRegSuccess('');
    setResetToken('');
    setShowPassword(false);
    setShowConfirm(false);
  };

  const switchMode = (mode: 'signin' | 'register') => {
    setAuthMode(mode);
    resetForm();
  };

  const goVerify = (em: string) => {
    setPendingEmail(em);
    setVerifyCode('');
    setAuthMode('verify');
    setError('');
    setRegSuccess(
      `We emailed a 6-digit code to ${em}. Open Gmail (Inbox or Spam), enter it below, then continue.`,
    );
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await apiLogin(email.trim(), password);
    setIsLoading(false);
    if (result.needsEmailVerification) {
      goVerify(result.email || email.trim().toLowerCase());
      return;
    }
    if (!result.success) {
      setError(userFacingError(result.error || 'Login failed.', { context: 'login' }));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError('');
    const result = await registerAccount({
      name: trimmedName,
      email: trimmedEmail,
      password,
      phone: trimmedPhone,
    });
    setIsLoading(false);
    if (!result.success) {
      setError(userFacingError(result.error || 'Registration failed.', { context: 'register' }));
      return;
    }
    if (result.needsEmailVerification) {
      goVerify(result.email || trimmedEmail);
      return;
    }
    setRegSuccess(`Welcome, ${trimmedName}! You are signed in.`);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await verifyEmailCode(pendingEmail, verifyCode.trim());
    setIsLoading(false);
    if (!result.success) {
      setError(userFacingError(result.error || 'Verification failed.', { context: 'login' }));
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError('');
    const result = await resendVerificationCode(pendingEmail);
    setIsLoading(false);
    if (!result.success) {
      setError(userFacingError(result.error || 'Could not resend the code.', { context: 'login' }));
      return;
    }
    setVerifyCode('');
    setRegSuccess(`A new code was emailed to ${pendingEmail}. Check Gmail Inbox and Spam.`);
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await requestPasswordReset(trimmedEmail);
    setIsLoading(false);
    if (!result.success) {
      setError(userFacingError(result.error || 'Could not send reset code.', { context: 'login' }));
      return;
    }
    setPendingEmail(result.email || trimmedEmail);
    setVerifyCode('');
    setResetToken('');
    setPassword('');
    setConfirmPassword('');
    setAuthMode('reset-code');
    setRegSuccess(
      `If an account exists, a 6-digit code was emailed to ${result.email || trimmedEmail}. Check Gmail.`,
    );
  };

  const handleResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      setError('Enter the 6-digit code.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await verifyResetCode(pendingEmail, verifyCode.trim());
    setIsLoading(false);
    if (!result.success || !result.resetToken) {
      setError(userFacingError(result.error || 'Invalid or expired code.', { context: 'login' }));
      return;
    }
    setResetToken(result.resetToken);
    setPassword('');
    setConfirmPassword('');
    setAuthMode('reset-choice');
    setRegSuccess('Code verified. Change your password or keep the current one.');
  };

  const handleKeepPassword = async () => {
    if (!resetToken) {
      setError('Reset session expired. Request a new code.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await completePasswordReset({
      email: pendingEmail,
      code: verifyCode.trim(),
      resetToken,
      action: 'keep',
    });
    setIsLoading(false);
    if (!result.success) {
      setError(userFacingError(result.error || 'Could not finish reset.', { context: 'login' }));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!resetToken) {
      setError('Reset session expired. Request a new code.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await completePasswordReset({
      email: pendingEmail,
      code: verifyCode.trim(),
      resetToken,
      action: 'change',
      newPassword: password,
    });
    setIsLoading(false);
    if (!result.success) {
      setError(userFacingError(result.error || 'Could not update password.', { context: 'login' }));
    }
  };

  const showTabs = authMode === 'signin' || authMode === 'register';

  const modeTitle: Record<AuthMode, string> = {
    signin: 'Welcome back',
    register: 'Join the network',
    verify: 'Verify your email',
    forgot: 'Reset password',
    'reset-code': 'Enter reset code',
    'reset-choice': 'Choose password',
  };

  const modeSubtitle: Record<AuthMode, string> = {
    signin: 'Sign in to continue to your account',
    register: 'Create your ABN account to get started',
    verify: 'Enter the code we emailed you',
    forgot: 'We will email a reset code to Gmail',
    'reset-code': 'Check Inbox or Spam for your code',
    'reset-choice': 'Update your password or keep the current one',
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col text-white overflow-y-auto bg-[#0D0906]"
      id="auth-screen-root"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Network pattern — charcoal + orange dots */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(circle at 12% 8%, rgba(240,140,50,0.55) 1.5px, transparent 1.6px),
            radial-gradient(circle at 28% 18%, rgba(240,140,50,0.4) 1.2px, transparent 1.3px),
            radial-gradient(circle at 72% 12%, rgba(240,140,50,0.45) 1.4px, transparent 1.5px),
            radial-gradient(circle at 88% 22%, rgba(240,140,50,0.35) 1.2px, transparent 1.3px),
            radial-gradient(circle at 18% 32%, rgba(43,35,29,0.9) 1px, transparent 1.1px),
            radial-gradient(circle at 82% 38%, rgba(43,35,29,0.9) 1px, transparent 1.1px),
            radial-gradient(rgba(43,35,29,0.55) 0.8px, transparent 0.9px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 22px 22px',
        }}
      />
      <svg
        className="pointer-events-none absolute inset-0 w-full h-[55%] opacity-40"
        viewBox="0 0 400 320"
        fill="none"
        aria-hidden
        preserveAspectRatio="xMidYMin slice"
      >
        <path d="M40 40 L110 70 L180 45 L250 85 L320 50 L360 90" stroke="#F08C32" strokeWidth="0.8" opacity="0.35" />
        <path d="M60 120 L140 95 L210 130 L290 100 L350 140" stroke="#F08C32" strokeWidth="0.8" opacity="0.28" />
        <path d="M90 60 L90 150 M180 45 L180 130 M290 55 L290 140" stroke="#2B231D" strokeWidth="0.7" opacity="0.8" />
        <circle cx="110" cy="70" r="2.2" fill="#F08C32" />
        <circle cx="180" cy="45" r="2.2" fill="#F08C32" />
        <circle cx="250" cy="85" r="2.2" fill="#F08C32" />
        <circle cx="140" cy="95" r="2" fill="#F08C32" />
        <circle cx="290" cy="100" r="2" fill="#F08C32" />
      </svg>

      <div className="relative flex-1 flex items-start sm:items-center justify-center px-4 pt-8 pb-8 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
          id="auth-screen-content"
        >
          {/* Logo card */}
          <div className="mb-5 flex flex-col items-center" id="auth-logo">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.35 }}
              className="flex items-center justify-center"
            >
              <img
                src="/abn-logo-login-clear.png"
                alt="ABN — Ahlebait Network"
                className="h-[180px] w-auto max-w-[min(90vw,320px)] object-contain object-center"
                draggable={false}
              />
            </motion.div>
            <p className="mt-3 text-center text-[10px] font-semibold tracking-[0.18em] uppercase text-[#CFCFCF]">
              Connect <span className="text-[#F08C32]">•</span> Collaborate <span className="text-[#F08C32]">•</span> Grow
            </p>
            <h1 className="mt-4 text-center text-[22px] font-black text-white tracking-tight">
              {modeTitle[authMode]}
            </h1>
            <p className="mt-1.5 text-center text-[13px] text-[#8E8E8E] font-medium px-4">
              {modeSubtitle[authMode]}
            </p>
          </div>

          {/* Form card */}
          <div
            id="auth-form-card"
            className="rounded-[28px] border border-[#2B231D] bg-[#171310] shadow-[0_24px_60px_rgba(0,0,0,0.5)] p-5 sm:p-6"
          >
            {showTabs && (
              <div
                id="auth-tab-bar"
                className="relative mb-4 grid grid-cols-2 gap-2"
              >
                {(['signin', 'register'] as const).map((mode) => {
                  const active = authMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => switchMode(mode)}
                      className={`relative flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-colors ${
                        active
                          ? 'bg-[#FF9E47] text-white shadow-[0_8px_20px_rgba(240,140,50,0.35)]'
                          : 'bg-[#1E1915] text-[#CFCFCF] border border-[#2B231D] hover:text-white'
                      }`}
                    >
                      {mode === 'signin' ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                      {mode === 'signin' ? t.signIn : t.register}
                    </button>
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={authMode}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {error && (
                  <p className="mb-3 text-[#E84D4D] text-xs text-center bg-[#E84D4D]/15 border border-[#E84D4D]/40 p-2.5 rounded-xl">
                    {error}
                  </p>
                )}
                {regSuccess && !error && (
                  <p className="mb-3 text-[#F08C32] text-xs text-center bg-[#FF9E47]/10 border border-[#F08C32]/30 p-2.5 rounded-xl">
                    {regSuccess}
                  </p>
                )}

                {authMode === 'signin' && (
                  <>
                    <p className="text-xs text-center text-[#8E8E8E] mb-4">{t.signInPrompt}</p>
                    <form onSubmit={handleSignIn} className="space-y-3.5">
                      <div>
                        <label className={labelClass}>{t.email} *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Mail className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            required
                            placeholder="email@gmail.com"
                            className={fieldClass}
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Password *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            required
                            placeholder="••••••••"
                            className={fieldClass}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E8E8E] hover:text-[#F08C32]"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className={primaryBtn}>
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                          </>
                        ) : (
                          t.signIn
                        )}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setError('');
                        setRegSuccess('');
                        setPassword('');
                      }}
                      className="w-full mt-4 text-center text-xs font-semibold text-[#F08C32] hover:underline"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="w-full mt-3 text-center text-xs"
                    >
                      <span className="text-[#8E8E8E]">New here? </span>
                      <span className="text-[#F08C32] font-bold">Register</span>
                    </button>
                  </>
                )}

                {authMode === 'register' && (
                  <>
                    <p className="text-xs text-center text-[#8E8E8E] mb-4">
                      Create your ABN account. We will email a code to verify before you sign in.
                    </p>
                    <form onSubmit={handleRegister} className="space-y-3.5">
                      <div>
                        <label className={labelClass}>{t.name} *</label>
                        <div className="relative">
                          <FieldIcon>
                            <User className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            required
                            placeholder="Your full name"
                            className={fieldClass}
                            autoComplete="name"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>{t.email} *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Mail className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            required
                            placeholder="email@gmail.com"
                            className={fieldClass}
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>{t.phone} *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Phone className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            placeholder="+1 555 000 0000"
                            className={fieldClass}
                            autoComplete="tel"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Password *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            required
                            minLength={6}
                            placeholder="At least 6 characters"
                            className={fieldClass}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E8E8E] hover:text-[#F08C32]"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Confirm password *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                            required
                            minLength={6}
                            placeholder="Re-enter password"
                            className={fieldClass}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E8E8E] hover:text-[#F08C32]"
                          >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className={primaryBtn}>
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                          </>
                        ) : (
                          t.createAccount
                        )}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="w-full mt-4 text-center text-xs"
                    >
                      <span className="text-[#8E8E8E]">Already have an account? </span>
                      <span className="text-[#F08C32] font-bold">Sign In</span>
                    </button>
                  </>
                )}

                {authMode === 'verify' && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3 text-[#F08C32]">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-wider">Verify Email</span>
                    </div>
                    <form onSubmit={handleVerify} className="space-y-3.5" id="form-verify-email">
                      <div>
                        <label className={labelClass}>6-digit code *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={verifyCode}
                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            placeholder="123456"
                            className={`${fieldClass} tracking-[0.35em] font-semibold text-center pr-4`}
                            autoComplete="one-time-code"
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className={primaryBtn}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="w-full mt-3 text-xs text-[#8E8E8E] hover:text-[#F08C32]"
                    >
                      Resend code
                    </button>
                    <a
                      href={SUPPORT_MAILTO}
                      className="block w-full mt-2 text-center text-[10px] text-[#8E8E8E] hover:text-[#F08C32]"
                    >
                      Contact support
                    </a>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-[#8E8E8E] hover:text-white"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                    </button>
                  </>
                )}

                {authMode === 'forgot' && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3 text-[#F08C32]">
                      <KeyRound className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-wider">Forgot Password</span>
                    </div>
                    <p className="text-xs text-center text-[#8E8E8E] mb-4">
                      Enter your account email. We will send a 6-digit code to Gmail.
                    </p>
                    <form onSubmit={handleForgotRequest} className="space-y-3.5" id="form-forgot-password">
                      <div>
                        <label className={labelClass}>{t.email} *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Mail className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            required
                            placeholder="email@gmail.com"
                            className={fieldClass}
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className={primaryBtn}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset code'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs text-[#8E8E8E] hover:text-white"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                    </button>
                  </>
                )}

                {authMode === 'reset-code' && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3 text-[#F08C32]">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-wider">Enter Reset Code</span>
                    </div>
                    <form onSubmit={handleResetCode} className="space-y-3.5" id="form-reset-code">
                      <div>
                        <label className={labelClass}>6-digit code *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={verifyCode}
                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            placeholder="123456"
                            className={`${fieldClass} tracking-[0.35em] font-semibold text-center pr-4`}
                            autoComplete="one-time-code"
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className={primaryBtn}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify code'}
                      </button>
                    </form>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={async () => {
                        setIsLoading(true);
                        setError('');
                        const result = await requestPasswordReset(pendingEmail);
                        setIsLoading(false);
                        if (!result.success) {
                          setError(userFacingError(result.error || 'Could not resend the code.', { context: 'login' }));
                          return;
                        }
                        setVerifyCode('');
                        setRegSuccess('A new reset code was emailed. Check Gmail Inbox and Spam.');
                      }}
                      className="w-full mt-3 text-xs text-[#8E8E8E] hover:text-[#F08C32]"
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="w-full mt-3 text-xs text-[#8E8E8E] hover:text-white"
                    >
                      Back to Sign In
                    </button>
                  </>
                )}

                {authMode === 'reset-choice' && (
                  <>
                    <p className="text-xs text-center text-[#8E8E8E] mb-4">
                      Change your password, or keep the current one and sign in.
                    </p>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleKeepPassword}
                      className="w-full py-3 mb-3 rounded-2xl border border-[#2B231D] text-sm font-bold text-white hover:border-[#F08C32]/50 bg-[#1E1915] disabled:opacity-55"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Keep current password'}
                    </button>
                    <form onSubmit={handleChangePassword} className="space-y-3.5">
                      <div>
                        <label className={labelClass}>New password *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="At least 6 characters"
                            className={fieldClass}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Confirm new password *</label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="w-4 h-4 text-[#F08C32]" />
                          </FieldIcon>
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="Re-enter password"
                            className={fieldClass}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className={primaryBtn}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change password & sign in'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="w-full mt-4 text-xs text-[#8E8E8E] hover:text-white"
                    >
                      Back to Sign In
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
