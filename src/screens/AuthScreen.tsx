import React, { useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Mail, Phone, User, LogIn, UserPlus, Lock, Loader2 } from 'lucide-react';
import { AbnBrandMark } from '../components/AbnBrandMark';

/** Full-screen auth gateway — Sign In / Register only (no guest, no demo shortcuts) */
export const AuthScreen: React.FC = () => {
  const { language, apiLogin, registerAccount } = useDirectory();
  const t = TRANSLATIONS[language];

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setPhone('');
    setName('');
    setError('');
    setRegSuccess('');
  };

  const switchMode = (mode: 'signin' | 'register') => {
    setAuthMode(mode);
    resetForm();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(language === 'en' ? 'Email and password are required.' : 'البريد الإلكتروني وكلمة المرور مطلوبان.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await apiLogin(email.trim(), password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || (language === 'en' ? 'Login failed.' : 'فشل تسجيل الدخول.'));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError(language === 'en' ? 'Name, email and password are required.' : 'الاسم والبريد وكلمة المرور مطلوبة.');
      return;
    }
    if (password.length < 6) {
      setError(language === 'en' ? 'Password must be at least 6 characters.' : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await registerAccount({
      name: name.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
    });
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || (language === 'en' ? 'Registration failed.' : 'فشل التسجيل.'));
      return;
    }
    setRegSuccess(
      language === 'en'
        ? `Welcome, ${name.trim()}! Account created.`
        : `أهلاً ${name.trim()}! تم إنشاء حسابك.`,
    );
  };

  const inputCls =
    'w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] outline-none text-sm transition-colors text-[#F4E3D7] placeholder-gray-600';

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
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      required
                      placeholder="email@example.com"
                      className={inputCls}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    {language === 'en' ? 'Password' : 'كلمة المرور'} *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
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
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold hover:bg-opacity-90 transition-all shadow-md text-sm active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {language === 'en' ? 'Signing in…' : 'جارٍ الدخول…'}
                    </>
                  ) : (
                    t.signIn
                  )}
                </button>
              </form>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="w-full mt-3 text-center text-xs text-gray-500 hover:text-[#FFA048] transition-colors"
              >
                {t.noAccountYet}
              </button>
            </>
          )}

          {authMode === 'register' && (
            <>
              <p className="text-xs text-center text-gray-400 mb-4">
                {language === 'en'
                  ? 'Create your free ABN user account. Business and service listings are added later from the directory.'
                  : 'أنشئ حساب مستخدم مجاني. تُضاف listings الأعمال والخدمات لاحقاً من الدليل.'}
              </p>
              <form onSubmit={handleRegister} className="space-y-3">
                {error && <p className="text-red-400 text-xs text-center bg-red-950/30 p-2 rounded-lg">{error}</p>}
                {regSuccess && (
                  <p className="text-green-400 text-xs text-center bg-green-950/30 p-2 rounded-lg font-bold">{regSuccess}</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.name} *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError('');
                      }}
                      required
                      placeholder="Mahdi Jafar Al-Husseini"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.email} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      required
                      placeholder="email@example.com"
                      className={inputCls}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">{t.phone}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 770 000 0000"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    {language === 'en' ? 'Password' : 'كلمة المرور'} *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      required
                      placeholder="Min. 6 characters"
                      className={inputCls}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-[#FFA048] text-black font-bold hover:bg-opacity-90 transition-all shadow-md text-sm active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {language === 'en' ? 'Creating account…' : 'جارٍ الإنشاء…'}
                    </>
                  ) : (
                    t.createAccount
                  )}
                </button>
              </form>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="w-full mt-3 text-center text-xs text-gray-500 hover:text-[#FFA048] transition-colors"
              >
                {t.alreadyHaveAccount}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
