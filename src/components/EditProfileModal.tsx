import React, { useState, useMemo } from 'react';
import { ArrowLeft, Save, User, Briefcase, Zap, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Business } from '../types';
import { ImageUploadGrid } from './ImageUploadGrid';
import { getUserListing } from '../utils/listingAccess';
import { apiFetch } from '../lib/api';

interface EditProfileModalProps {
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
  const {
    language,
    currentUser,
    businesses,
    categories,
    updateUserProfile,
    changePassword,
    updateBusiness,
    addBusiness,
    apiToken,
    refreshDirectory,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  const myBusiness = useMemo(
    () => getUserListing(currentUser, businesses),
    [businesses, currentUser],
  );

  // Directory listing edits live under Account → Manage Business/Service
  const isListingOwner = false;

  // ── Customer / Admin account fields ─────────────────────────────────────
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  // ── Business / Service Provider listing fields ────────────────────────────
  const [bizName, setBizName] = useState(myBusiness?.name || currentUser?.name || '');
  const [categoryId, setCategoryId] = useState(
    myBusiness?.categoryId || categories[0]?.id || '',
  );
  const [subcatEn, setSubcatEn] = useState(myBusiness?.subcategory.en || '');
  const [descEn, setDescEn] = useState(myBusiness?.description.en || '');
  const [address, setAddress] = useState(myBusiness?.address || '');
  const [area, setArea] = useState(myBusiness?.area || '');
  const [city, setCity] = useState(myBusiness?.city || 'New York');
  const [bizPhone, setBizPhone] = useState(myBusiness?.phone || currentUser?.phone || '');
  const [whatsapp, setWhatsapp] = useState(myBusiness?.whatsapp || '');
  const [hoursEn, setHoursEn] = useState(myBusiness?.workingHours.en || '9:00 AM - 9:00 PM');
  const [images, setImages] = useState<string[]>(() => {
    if (myBusiness?.gallery?.length) return myBusiness.gallery.slice(0, 5);
    if (myBusiness?.logoUrl) return [myBusiness.logoUrl];
    return [];
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const planAmount = currentUser?.role === 'service_provider' ? 30 : 50;

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(language === 'en' ? 'Name is required.' : 'الاسم مطلوب.');
      return;
    }
    setSaving(true);
    const result = await updateUserProfile({
      name: name.trim(),
      phone: phone.trim(),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || (language === 'en' ? 'Could not save profile.' : 'تعذر الحفظ.'));
      return;
    }
    setSuccess(t.profileUpdated);
    setTimeout(onClose, 1200);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwError(language === 'en' ? 'All password fields are required.' : 'جميع حقول كلمة المرور مطلوبة.');
      return;
    }
    if (newPassword.length < 10) {
      setPwError(language === 'en' ? 'New password must be at least 10 characters.' : 'كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwError(language === 'en' ? 'New passwords do not match.' : 'كلمتا المرور غير متطابقتين.');
      return;
    }
    setPwBusy(true);
    const result = await changePassword(currentPassword, newPassword);
    setPwBusy(false);
    if (!result.success) {
      setPwError(result.error || (language === 'en' ? 'Could not change password.' : 'تعذر تغيير كلمة المرور.'));
      return;
    }
    setPwSuccess(language === 'en' ? 'Password updated successfully.' : 'تم تحديث كلمة المرور.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setTimeout(() => {
      setShowChangePassword(false);
      setPwSuccess('');
    }, 1500);
  };

  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!bizName.trim() || !subcatEn.trim() || !descEn.trim() || !bizPhone.trim() || !whatsapp.trim()) {
      setError(t.allFieldsRequired);
      return;
    }

    setSaving(true);
    const cat = categories.find((c) => c.id === categoryId);
    const categoryLabel = subcatEn || cat?.name.en || 'General';
    const logoUrl = images[0] || myBusiness?.logoUrl || '';
    const coverUrl = images[1] || myBusiness?.coverUrl || logoUrl;

    const payload = {
      businessName: bizName.trim(),
      category: categoryLabel,
      description: descEn.trim(),
      imageUrl: logoUrl,
      coverUrl,
      address: address.trim(),
      area: area.trim(),
      city,
      phone: bizPhone.trim(),
      whatsapp: whatsapp.trim(),
      workingHours: hoursEn.trim(),
      subscriptionTier: planAmount,
    };

    if (apiToken) {
      try {
        if (myBusiness) {
          const res = await apiFetch(`/api/directory/${myBusiness.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiToken}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            setSaving(false);
            setError(data.error || (language === 'en' ? 'Could not update listing.' : 'تعذر التحديث.'));
            return;
          }
        } else {
          const res = await apiFetch('/api/directory', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiToken}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            setSaving(false);
            setError(data.error || (language === 'en' ? 'Could not create listing.' : 'تعذر الإنشاء.'));
            return;
          }
          const created: Business = {
            id: String(data.id),
            ownerId: currentUser!.email,
            name: bizName.trim(),
            logoUrl,
            coverUrl,
            description: { en: descEn, ar: descEn },
            categoryId,
            subcategory: { en: subcatEn, ar: subcatEn },
            address: address.trim(),
            city: city as Business['city'],
            area: area.trim(),
            isVerified: Boolean(data.isVerified),
            status: 'active',
            phone: bizPhone.trim(),
            whatsapp: whatsapp.trim(),
            workingHours: { en: hoursEn, ar: hoursEn },
            membershipExpiryDate: String(data.membershipExpiry ?? ''),
            gallery: images.length > 0 ? images : [logoUrl],
            rating: 0,
            reviewsCount: 0,
          };
          addBusiness(created);
        }
        await refreshDirectory();
        setSaving(false);
        setSuccess(t.profileUpdated);
        setTimeout(onClose, 1200);
        return;
      } catch {
        setSaving(false);
        setError(language === 'en' ? 'Cannot reach server. Make sure the backend is running.' : 'تعذر الاتصال بالخادم.');
        return;
      }
    }

    setSaving(false);
    setError(language === 'en' ? 'You must be signed in to save your listing.' : 'يجب تسجيل الدخول لحفظ النشاط.');
  };

  const headerIcon = isListingOwner
    ? (currentUser?.role === 'service_provider'
      ? <Zap className="w-4 h-4 text-orange-400" />
      : <Briefcase className="w-4 h-4 text-[#EA580C]" />)
    : <User className="w-4 h-4 text-[#EA580C]" />;

  const headerSubtitle = isListingOwner
    ? (myBusiness
      ? (language === 'en' ? 'Update your directory listing' : 'تحديث بيانات الإدراج')
      : (language === 'en' ? 'Create your directory listing' : 'إنشاء إدراج جديد'))
    : t.accountSettings;

  return (
    <div className="space-y-4 animate-fade-in" id="account-edit-profile-section">
      <div className="flex items-center gap-3 pb-2 border-b border-[#D7E0EA]/60">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-[#EEF2F6] hover:bg-slate-100 border border-[#D7E0EA] transition-colors"
          aria-label="Back"
          id="btn-edit-profile-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#EA580C]" />
        </button>
        <div>
          <h2 className="text-sm font-extrabold text-[#7C2D12] flex items-center gap-2">
            {headerIcon}
            {t.editProfile}
          </h2>
          <p className="text-[10px] text-gray-500">{headerSubtitle}</p>
        </div>
      </div>

      {isListingOwner ? (
        <form onSubmit={handleSaveListing} className="space-y-4 p-5 rounded-2xl bg-white border border-[#D7E0EA]">
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-2.5">{error}</p>
          )}
          {success && (
            <p className="text-xs text-green-400 bg-green-950/30 border border-green-900/50 rounded-xl p-2.5">{success}</p>
          )}

          <ImageUploadGrid
            id="edit-profile-image-upload"
            images={images}
            onChange={setImages}
            language={language}
            label={language === 'en' ? 'Upload Business/Service Images' : 'رفع صور النشاط'}
          />

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
              {currentUser?.role === 'service_provider' ? (language === 'en' ? 'Service Name*' : 'اسم الخدمة*') : `${t.businessName}*`}
            </label>
            <input
              type="text"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none"
              id="edit-profile-biz-name"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold app-label mb-1.5 uppercase tracking-wider">{t.selectCategory}*</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full p-3 rounded-xl border text-xs app-field outline-none"
                id="edit-profile-category"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.subcategories}*</label>
              <input
                type="text"
                value={subcatEn}
                onChange={(e) => setSubcatEn(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none"
                id="edit-profile-subcategory"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.description}*</label>
            <textarea
              rows={3}
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none resize-none"
              id="edit-profile-description"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.phone}*</label>
              <input
                type="tel"
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none"
                id="edit-profile-phone"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.whatsapp}*</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none"
                id="edit-profile-whatsapp"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#EA580C] hover:bg-opacity-95 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            id="btn-save-listing-profile"
          >
            <Save className="w-4 h-4" />
            {saving ? (language === 'en' ? 'Saving…' : 'جارٍ الحفظ…') : t.saveChanges}
          </button>
        </form>
      ) : (
        <>
        <form onSubmit={handleSaveAccount} className="space-y-4 p-5 rounded-2xl bg-white border border-[#D7E0EA]">
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-2.5">{error}</p>
          )}
          {success && (
            <p className="text-xs text-green-400 bg-green-950/30 border border-green-900/50 rounded-xl p-2.5">{success}</p>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.email}</label>
            <input type="email" value={currentUser?.email || ''} readOnly className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] text-xs text-gray-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.name}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.phone}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none" />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#EA580C] hover:bg-opacity-95 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            id="btn-save-user-profile"
          >
            <Save className="w-4 h-4" />
            {saving ? (language === 'en' ? 'Saving…' : 'جارٍ الحفظ…') : t.saveChanges}
          </button>
        </form>

        <div className="p-5 rounded-2xl bg-white border border-[#D7E0EA] space-y-3" id="edit-profile-change-password">
          <button
            type="button"
            onClick={() => {
              setShowChangePassword((v) => !v);
              setPwError('');
              setPwSuccess('');
            }}
            className="w-full flex items-center justify-between gap-2 text-left"
            id="btn-toggle-change-password"
          >
            <span className="flex items-center gap-2 text-xs font-extrabold text-[#7C2D12]">
              <KeyRound className="w-4 h-4 text-[#EA580C]" />
              {language === 'en' ? 'Change Password' : 'تغيير كلمة المرور'}
            </span>
            <span className="text-[10px] font-bold text-[#EA580C]">
              {showChangePassword ? (language === 'en' ? 'Hide' : 'إخفاء') : (language === 'en' ? 'Show' : 'إظهار')}
            </span>
          </button>

          {showChangePassword && (
            <form onSubmit={handleChangePassword} className="space-y-3 pt-1 border-t border-[#D7E0EA]">
              {pwError && (
                <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-2.5">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-xs text-green-400 bg-green-950/30 border border-green-900/50 rounded-xl p-2.5">{pwSuccess}</p>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                  {language === 'en' ? 'Current password' : 'كلمة المرور الحالية'}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full p-3 pr-10 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none"
                    id="edit-profile-current-password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                  {language === 'en' ? 'New password' : 'كلمة المرور الجديدة'}
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 pr-10 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none"
                    id="edit-profile-new-password"
                    autoComplete="new-password"
                    minLength={10}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    aria-label={showNewPw ? 'Hide password' : 'Show password'}
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                  {language === 'en' ? 'Confirm new password' : 'تأكيد كلمة المرور الجديدة'}
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#EEF2F6] border border-[#D7E0EA] focus:border-[#EA580C] text-xs text-[#7C2D12] outline-none"
                  id="edit-profile-confirm-password"
                  autoComplete="new-password"
                  minLength={10}
                />
              </div>

              <button
                type="submit"
                disabled={pwBusy}
                className="w-full py-3 rounded-xl border border-[#EA580C]/50 bg-[#EA580C]/15 hover:bg-[#EA580C]/25 text-[#EA580C] font-extrabold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                id="btn-submit-change-password"
              >
                {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {pwBusy
                  ? (language === 'en' ? 'Updating…' : 'جارٍ التحديث…')
                  : (language === 'en' ? 'Update Password' : 'تحديث كلمة المرور')}
              </button>
            </form>
          )}
        </div>
        </>
      )}
    </div>
  );
};
