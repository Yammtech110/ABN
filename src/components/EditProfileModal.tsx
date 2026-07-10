import React, { useState, useMemo } from 'react';
import { ArrowLeft, Save, User, Briefcase, Zap } from 'lucide-react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Business } from '../types';
import { ImageUploadGrid } from './ImageUploadGrid';
import { getUserListing } from '../utils/listingAccess';
import { apiFetch } from '../lib/api';

const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200';

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
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'ar'>(
    currentUser?.preferredLanguage || 'en',
  );

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
      preferredLanguage,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || (language === 'en' ? 'Could not save profile.' : 'تعذر الحفظ.'));
      return;
    }
    setSuccess(t.profileUpdated);
    setTimeout(onClose, 1200);
  };

  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!bizName.trim() || !subcatEn.trim() || !descEn.trim() || !bizPhone.trim()) {
      setError(t.allFieldsRequired);
      return;
    }

    setSaving(true);
    const cat = categories.find((c) => c.id === categoryId);
    const categoryLabel = subcatEn || cat?.name.en || 'General';
    const logoUrl = images[0] || myBusiness?.logoUrl || DEFAULT_LOGO;
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
      } catch {
        console.warn('[ABN] API save failed — saving locally.');
      }
    }

    if (myBusiness) {
      updateBusiness({
        ...myBusiness,
        name: bizName.trim(),
        categoryId,
        subcategory: { en: subcatEn, ar: subcatEn },
        description: { en: descEn, ar: descEn },
        address: address.trim(),
        area: area.trim(),
        city: city as Business['city'],
        phone: bizPhone.trim(),
        whatsapp: whatsapp.trim(),
        workingHours: { en: hoursEn, ar: hoursEn },
        logoUrl,
        coverUrl,
        gallery: images.length > 0 ? images : myBusiness.gallery,
      });
    } else if (!apiToken) {
      addBusiness({
        id: `biz-${Date.now()}`,
        ownerId: currentUser?.email || currentUser?.id || '',
        name: bizName.trim(),
        logoUrl,
        coverUrl,
        description: { en: descEn, ar: descEn },
        categoryId,
        subcategory: { en: subcatEn, ar: subcatEn },
        address: address.trim(),
        city: city as Business['city'],
        area: area.trim(),
        isVerified: false,
        status: 'active',
        phone: bizPhone.trim(),
        whatsapp: whatsapp.trim(),
        workingHours: { en: hoursEn, ar: hoursEn },
        membershipExpiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        gallery: images.length > 0 ? images : [logoUrl],
        rating: 0,
        reviewsCount: 0,
      });
    }

    setSaving(false);
    setSuccess(t.profileUpdated);
    setTimeout(onClose, 1200);
  };

  const headerIcon = isListingOwner
    ? (currentUser?.role === 'service_provider'
      ? <Zap className="w-4 h-4 text-blue-400" />
      : <Briefcase className="w-4 h-4 text-[#FFA048]" />)
    : <User className="w-4 h-4 text-[#FFA048]" />;

  const headerSubtitle = isListingOwner
    ? (myBusiness
      ? (language === 'en' ? 'Update your directory listing' : 'تحديث بيانات الإدراج')
      : (language === 'en' ? 'Create your directory listing' : 'إنشاء إدراج جديد'))
    : t.accountSettings;

  return (
    <div className="space-y-4 animate-fade-in" id="account-edit-profile-section">
      <div className="flex items-center gap-3 pb-2 border-b border-[#2D2319]/60">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
          aria-label="Back"
          id="btn-edit-profile-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
        </button>
        <div>
          <h2 className="text-sm font-extrabold text-[#F4E3D7] flex items-center gap-2">
            {headerIcon}
            {t.editProfile}
          </h2>
          <p className="text-[10px] text-gray-500">{headerSubtitle}</p>
        </div>
      </div>

      {isListingOwner ? (
        <form onSubmit={handleSaveListing} className="space-y-4 p-5 rounded-2xl bg-[#13110E] border border-[#2D2319]">
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
              className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none"
              id="edit-profile-biz-name"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.selectCategory}*</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#FFA048] outline-none"
                id="edit-profile-category"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name[language] || c.name.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.subcategories}*</label>
              <input
                type="text"
                value={subcatEn}
                onChange={(e) => setSubcatEn(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none"
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
              className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none resize-none"
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
                className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none"
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
                className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none"
                id="edit-profile-whatsapp"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            id="btn-save-listing-profile"
          >
            <Save className="w-4 h-4" />
            {saving ? (language === 'en' ? 'Saving…' : 'جارٍ الحفظ…') : t.saveChanges}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSaveAccount} className="space-y-4 p-5 rounded-2xl bg-[#13110E] border border-[#2D2319]">
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-2.5">{error}</p>
          )}
          {success && (
            <p className="text-xs text-green-400 bg-green-950/30 border border-green-900/50 rounded-xl p-2.5">{success}</p>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.email}</label>
            <input type="email" value={currentUser?.email || ''} readOnly className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-gray-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.name}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.phone}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none" />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            id="btn-save-user-profile"
          >
            <Save className="w-4 h-4" />
            {saving ? (language === 'en' ? 'Saving…' : 'جارٍ الحفظ…') : t.saveChanges}
          </button>
        </form>
      )}
    </div>
  );
};
