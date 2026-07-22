import React, { useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Mail, Phone, User, LogIn, UserPlus, Lock, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { AbnBrandMark } from '../components/AbnBrandMark';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../data/legalContent';

type AuthMode = 'signin' | 'register' | 'verify' | 'forgot' | 'reset-code' | 'reset-choice';

/** Full-screen auth gateway — Sign In / Register / Forgot password + email verification */
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
  const [hintCode, setHintCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setName('');
    setVerifyCode('');
    setError('');
    setRegSuccess('');
    setHintCode('');
    setResetToken('');
  };

  const switchMode = (mode: 'signin' | 'register') => {
    setAuthMode(mode);
    resetForm();
  };

  const goVerify = (em: string) => {
    setPendingEmail(em);
    setHintCode('');
    setVerifyCode('');
    setAuthMode('verify');
    setError('');
    setRegSuccess(
      `We emailed a 6-digit code to ${em}. Open Gmail (inbox or Spam), enter the code here, then continue.`,
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
      setError('All fields are required. Please fill in name, email, phone, password, and confirm password.');
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
    setRegSuccess(`Welcome, ${trimmedName}! Account created — you are now signed in.`);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      setError('Enter the 6-digit code.');
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
    setHintCode('');
    setVerifyCode('');
    setRegSuccess(`A new code was emailed to ${pendingEmail}. Check Gmail inbox and Spam.`);
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
    setHintCode('');
    setVerifyCode('');
    setResetToken('');
    setPassword('');
    setConfirmPassword('');
    setAuthMode('reset-code');
    setRegSuccess(
      `If an account exists, a 6-digit code was emailed to ${result.email || trimmedEmail}. Check Gmail inbox and Spam.`,
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
      setError(result.error || 'Could not complete reset.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('New password must be at least 6 characters.');
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

  const inputCls =
    'w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] outline-none text-sm transition-colors text-[#F4E3D7] placeholder-gray-600';

  const showTabs = authMode === 'signin' || authMode === 'register';

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-[#191512] to-[#0A0705] text-[#F4E3D7] overflow-y-auto"
      id="auth-screen-root"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#13110E] border border-[#2D2319] p-6" id="auth-screen-content">
          <div className="flex justify-center pt-1 pb-2">
            <AbnBrandMark size="hero" />
          </div>

          {showTabs && (
            <div className="flex gap-1 p-1 bg-[#0F0E0C] rounded-2xl mb-5 border border-[#2D2319]">
              {(['signin', 'register'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                    authMode === mode ? 'bg-[#FFA048] text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {mode === 'signin' ? (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      {t.signIn}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      {t.register}
                    </>
                  )}
                </button>
              ))}
            </div>
          )}

          {authMode === 'verify' && (
            <>
              <div className="flex items-center justify-center gap-2 mb-3 text-[#FFA048]">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-wider">Verify Email</span>
              </div>
              {regSuccess && <p className="text-green-400 text-xs text-center bg-green-950/30 p-2 rounded-lg mb-3">{regSuccess}</p>}
              {hintCode && (
                <p className="text-[10px] text-amber-400 text-center mb-2 font-mono">Code: {hintCode}</p>
              )}
              <form onSubmit={handleVerify} className="space-y-3" id="form-verify-email">
                {error && <p className="text-red-400 text-xs text-center bg-red-950/30 p-2 rounded-lg">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">6-digit code *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      placeholder="123456"
                      className={inputCls}
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
                </button>
              </form>
              <button type="button" onClick={handleResend} disabled={isLoading} className="w-full mt-3 text-xs text-gray-500 hover:text-[#FFA048]">
                Resend code
              </button>
              <a href={SUPPORT_MAILTO} className="block w-full mt-2 text-center text-[10px] text-gray-600 hover:text-[#FFA048]">
                Contact support
              </a>
              <button type="button" onClick={() => switchMode('signin')} className="w-full mt-2 text-xs text-gray-500 hover:text-white">
                Back to Sign In
              </button>
            </>
          )}

          {authMode === 'forgot' && (
            <>
              <div className="flex items-center justify-center gap-2 mb-3 text-[#FFA048]">
                <KeyRound className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-wider">Forgot Password</span>
              </div>
              <p className="text-xs text-center text-gray-400 mb-4">
                Enter your account email. We will send a 6-digit code so you can reset or keep your password.
              </p>
              <form onSubmit={handleForgotRequest} className="space-y-3" id="form-forgot-password">
                {error && <p className="text-red-400 text-xs text-center bg-red-950/30 p-2 rounded-lg">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.email} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      required
                      placeholder="email@example.com"
                      className={inputCls}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset code'}
                </button>
              </form>
              <button type="button" onClick={() => switchMode('signin')} className="w-full mt-3 text-xs text-gray-500 hover:text-white">
                Back to Sign In
              </button>
            </>
          )}

          {authMode === 'reset-code' && (
            <>
              <div className="flex items-center justify-center gap-2 mb-3 text-[#FFA048]">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-wider">Enter Reset Code</span>
              </div>
              {regSuccess && <p className="text-green-400 text-xs text-center bg-green-950/30 p-2 rounded-lg mb-3">{regSuccess}</p>}
              {hintCode && (
                <p className="text-[10px] text-amber-400 text-center mb-2 font-mono">Code: {hintCode}</p>
              )}
              <form onSubmit={handleResetCode} className="space-y-3" id="form-reset-code">
                {error && <p className="text-red-400 text-xs text-center bg-red-950/30 p-2 rounded-lg">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">6-digit code *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      placeholder="123456"
                      className={inputCls}
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
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
                  setHintCode('');
                  setVerifyCode('');
                  setRegSuccess('A new reset code was emailed. Check Gmail inbox and Spam.');
                }}
                className="w-full mt-3 text-xs text-gray-500 hover:text-[#FFA048]"
              >
                Resend code
              </button>
              <button type="button" onClick={() => switchMode('signin')} className="w-full mt-2 text-xs text-gray-500 hover:text-white">
                Back to Sign In
              </button>
            </>
          )}

          {authMode === 'reset-choice' && (
            <>
              <div className="flex items-center justify-center gap-2 mb-3 text-[#FFA048]">
                <KeyRound className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-wider">Reset Password</span>
              </div>
              {regSuccess && <p className="text-green-400 text-xs text-center bg-green-950/30 p-2 rounded-lg mb-3">{regSuccess}</p>}
              {error && <p className="text-red-400 text-xs text-center bg-red-950/30 p-2 rounded-lg mb-3">{error}</p>}

              <button
                type="button"
                disabled={isLoading}
                onClick={handleKeepPassword}
                className="w-full py-3 mb-4 rounded-xl border border-[#2D2319] bg-[#0F0E0C] text-[#F4E3D7] font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:border-[#FFA048]"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Keep current password & sign in'}
              </button>

              <p className="text-[10px] text-center text-gray-500 uppercase tracking-wider mb-3">or set a new password</p>

              <form onSubmit={handleChangePassword} className="space-y-3" id="form-reset-password">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">New password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className={inputCls}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Confirm new password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className={inputCls}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change password & sign in'}
                </button>
              </form>
              <button type="button" onClick={() => switchMode('signin')} className="w-full mt-3 text-xs text-gray-500 hover:text-white">
                Back to Sign In
              </button>
            </>
          )}

          {authMode === 'signin' && (
            <>
              <p className="text-xs text-center text-gray-400 mb-4">{t.signInPrompt}</p>
              <form onSubmit={handleSignIn} className="space-y-3">
                {error && <p className="text-red-400 text-xs text-center bg-red-950/30 p-2 rounded-lg">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.email} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      required
                      placeholder="email@example.com"
                      className={inputCls}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      required
                      placeholder="••••••••"
                      className={inputCls}
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : t.signIn}
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
                className="w-full mt-3 text-center text-xs text-[#FFA048] hover:underline"
              >
                Forgot password?
              </button>
              <button type="button" onClick={() => switchMode('register')} className="w-full mt-2 text-center text-xs text-gray-500 hover:text-[#FFA048]">
                {t.noAccountYet}
              </button>
            </>
          )}

          {authMode === 'register' && (
            <>
              <p className="text-xs text-center text-gray-400 mb-4">
                Create your ABN account with email and password. You will verify your email before signing in.
              </p>
              <form onSubmit={handleRegister} className="space-y-3">
                {error && <p className="text-red-400 text-xs text-center bg-red-950/30 p-2 rounded-lg">{error}</p>}
                {regSuccess && !error && (
                  <p className="text-green-400 text-xs text-center bg-green-950/30 p-2 rounded-lg font-bold">{regSuccess}</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.name} *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} required className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.email} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} required className={inputCls} autoComplete="email" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.phone} *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} required minLength={6} className={inputCls} autoComplete="new-password" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Confirm password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} required minLength={6} className={inputCls} autoComplete="new-password" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : t.createAccount}
                </button>
              </form>
              <button type="button" onClick={() => switchMode('signin')} className="w-full mt-3 text-center text-xs text-gray-500 hover:text-[#FFA048]">
                {t.alreadyHaveAccount}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
