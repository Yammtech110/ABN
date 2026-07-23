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
import { AbnBrandMark } from '../components/AbnBrandMark';
import { SUPPORT_MAILTO } from '../data/legalContent';

type AuthMode = 'signin' | 'register' | 'verify' | 'forgot' | 'reset-code' | 'reset-choice';

const fieldClass =
  'w-full pl-11 pr-11 py-3.5 rounded-2xl bg-black/35 border border-[#3A2E22] focus:border-[#FFA048] focus:ring-1 focus:ring-[#FFA048]/35 outline-none text-[15px] text-[#F8EDE3] placeholder:text-[#7A6A5A] transition-all';

const labelClass = 'block text-[11px] font-semibold tracking-wide text-[#C9A887] mb-1.5 uppercase';

const primaryBtn =
  'w-full py-3.5 mt-1 rounded-2xl bg-gradient-to-r from-[#FFB35C] to-[#FF8F2E] text-black font-black text-sm tracking-wide shadow-[0_10px_28px_rgba(255,160,72,0.28)] hover:brightness-105 active:scale-[0.985] transition-all disabled:opacity-55 flex items-center justify-center gap-2';

/** Premium auth gateway — Sign In / Register / OTP / Forgot password (backend-wired) */
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
      setError(result.error || 'Login failed.');
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
      setError(result.error || 'Registration failed.');
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
      setError(result.error || 'Verification failed.');
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError('');
    const result = await resendVerificationCode(pendingEmail);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Could not resend.');
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
      setError(result.error || 'Could not send code.');
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
      setError(result.error || 'Invalid or expired code.');
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
      setError(result.error || 'Could not finish reset.');
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
      setError(result.error || 'Could not update password.');
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

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col text-[#F8EDE3] overflow-y-auto"
      id="auth-screen-root"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background:
          'radial-gradient(120% 80% at 50% -10%, #3A2818 0%, #1A120E 42%, #0A0705 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,176,90,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,176,90,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(circle at 50% 20%, black 20%, transparent 75%)',
        }}
      />

      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
          id="auth-screen-content"
        >
          <div className="mb-6 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.4 }}
              className="rounded-[28px] p-[1px] bg-gradient-to-b from-[#E8C278]/70 to-[#5A4020]/20 shadow-[0_0_48px_rgba(255,160,72,0.18)]"
            >
              <div className="rounded-[27px] bg-[#100C09]/90 px-6 py-5 backdrop-blur-md border border-white/5">
                <AbnBrandMark size="hero" />
              </div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 text-center text-[13px] text-[#B9A28A]"
            >
              {modeTitle[authMode]}
            </motion.p>
          </div>

          <div
            id="auth-form-card"
            className="rounded-[28px] border border-[#3A2E22]/90 bg-[#13100D]/88 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-5 sm:p-6"
          >
            {showTabs && (
              <div
                id="auth-tab-bar"
                className="relative mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-black/40 p-1 border border-[#2D2319]"
              >
                {(['signin', 'register'] as const).map((mode) => {
                  const active = authMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => switchMode(mode)}
                      className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors ${
                        active ? 'text-black' : 'text-[#D4C4B0] hover:text-[#F8EDE3]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="authTabPill"
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#FFB35C] to-[#FF8F2E] shadow-md"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        {mode === 'signin' ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                        {mode === 'signin' ? t.signIn : t.register}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={authMode}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                {error && (
                  <p className="mb-3 text-red-300 text-xs text-center bg-red-950/40 border border-red-900/50 p-2.5 rounded-xl">
                    {error}
                  </p>
                )}
                {regSuccess && !error && (
                  <p className="mb-3 text-emerald-300 text-xs text-center bg-emerald-950/35 border border-emerald-900/40 p-2.5 rounded-xl">
                    {regSuccess}
                  </p>
                )}

                {authMode === 'signin' && (
                  <>
                    <p className="text-xs text-center text-[#C9B8A4] mb-4">{t.signInPrompt}</p>
                    <form onSubmit={handleSignIn} className="space-y-3.5">
                      <div>
                        <label className={labelClass}>{t.email} *</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A7A68] hover:text-[#FFA048]"
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
                      className="w-full mt-4 text-center text-xs font-semibold text-[#FFA048] hover:underline"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="w-full mt-2.5 text-center text-xs text-[#9A8A78] hover:text-[#F4E3D7]"
                    >
                      {t.noAccountYet}
                    </button>
                  </>
                )}

                {authMode === 'register' && (
                  <>
                    <p className="text-xs text-center text-[#9A8A78] mb-4">
                      Create your ABN account. We will email a code to verify before you sign in.
                    </p>
                    <form onSubmit={handleRegister} className="space-y-3.5">
                      <div>
                        <label className={labelClass}>{t.name} *</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A7A68] hover:text-[#FFA048]"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Confirm password *</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A7A68] hover:text-[#FFA048]"
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
                      className="w-full mt-4 text-center text-xs text-[#9A8A78] hover:text-[#F4E3D7]"
                    >
                      {t.alreadyHaveAccount}
                    </button>
                  </>
                )}

                {authMode === 'verify' && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3 text-[#FFA048]">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-wider">Verify Email</span>
                    </div>
                    <form onSubmit={handleVerify} className="space-y-3.5" id="form-verify-email">
                      <div>
                        <label className={labelClass}>6-digit code *</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                      className="w-full mt-3 text-xs text-[#9A8A78] hover:text-[#FFA048]"
                    >
                      Resend code
                    </button>
                    <a
                      href={SUPPORT_MAILTO}
                      className="block w-full mt-2 text-center text-[10px] text-[#6A5A4A] hover:text-[#FFA048]"
                    >
                      Contact support
                    </a>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-[#9A8A78] hover:text-white"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                    </button>
                  </>
                )}

                {authMode === 'forgot' && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3 text-[#FFA048]">
                      <KeyRound className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-wider">Forgot Password</span>
                    </div>
                    <p className="text-xs text-center text-[#9A8A78] mb-4">
                      Enter your account email. We will send a 6-digit code to Gmail.
                    </p>
                    <form onSubmit={handleForgotRequest} className="space-y-3.5" id="form-forgot-password">
                      <div>
                        <label className={labelClass}>{t.email} *</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                      className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs text-[#9A8A78] hover:text-white"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                    </button>
                  </>
                )}

                {authMode === 'reset-code' && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3 text-[#FFA048]">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-wider">Enter Reset Code</span>
                    </div>
                    <form onSubmit={handleResetCode} className="space-y-3.5" id="form-reset-code">
                      <div>
                        <label className={labelClass}>6-digit code *</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                          setError(result.error || 'Could not resend.');
                          return;
                        }
                        setVerifyCode('');
                        setRegSuccess('A new reset code was emailed. Check Gmail Inbox and Spam.');
                      }}
                      className="w-full mt-3 text-xs text-[#9A8A78] hover:text-[#FFA048]"
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="w-full mt-3 text-xs text-[#9A8A78] hover:text-white"
                    >
                      Back to Sign In
                    </button>
                  </>
                )}

                {authMode === 'reset-choice' && (
                  <>
                    <p className="text-xs text-center text-[#9A8A78] mb-4">
                      Change your password, or keep the current one and sign in.
                    </p>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleKeepPassword}
                      className="w-full py-3 mb-3 rounded-2xl border border-[#3A2E22] text-sm font-bold text-[#F4E3D7] hover:border-[#FFA048]/50 disabled:opacity-55"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Keep current password'}
                    </button>
                    <form onSubmit={handleChangePassword} className="space-y-3.5">
                      <div>
                        <label className={labelClass}>New password *</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A68]" />
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
                      className="w-full mt-4 text-xs text-[#9A8A78] hover:text-white"
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
