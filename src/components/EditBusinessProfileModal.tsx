import React, { useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Business } from '../types';
import { ArrowRight } from 'lucide-react';
import { ImageUploadGrid } from './ImageUploadGrid';
import { apiFetch } from '../lib/api';

const buildListingImages = (gallery: string[] | undefined, logoUrl?: string): string[] => {
  if (gallery && gallery.length > 0) return gallery.slice(0, 5);
  if (logoUrl) return [logoUrl];
  return [];
};

interface EditBusinessProfileModalProps {
  business: Business;
  onClose: () => void;
}

export const EditBusinessProfileModal: React.FC<EditBusinessProfileModalProps> = ({ business, onClose }) => {
  const { language, categories, updateBusiness, apiToken, refreshDirectory } = useDirectory();
  const t = TRANSLATIONS[language];

  const [name, setName] = useState(business.name);
  const [categoryId, setCategoryId] = useState(business.categoryId);
  const [subcatEn, setSubcatEn] = useState(business.subcategory.en || '');
  const [descEn, setDescEn] = useState(business.description.en || '');
  const [address, setAddress] = useState(business.address || '');
  const [area, setArea] = useState(business.area || '');
  const [city, setCity] = useState(business.city || 'New York');
  const [phone, setPhone] = useState(business.phone || '');
  const [whatsapp, setWhatsapp] = useState(business.whatsapp || '');
  const [hoursEn, setHoursEn] = useState(business.workingHours.en || '');
  const [images, setImages] = useState<string[]>(() => buildListingImages(business.gallery, business.logoUrl));
  const [coverUrl, setCoverUrl] = useState(business.coverUrl || '');

  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const updatedBiz: Business = {
      ...business,
      name,
      categoryId,
      subcategory: {
        en: subcatEn,
        ar: subcatEn,
        fa: business.subcategory.fa || subcatEn
      },
      description: {
        en: descEn,
        ar: descEn,
        fa: business.description.fa || descEn
      },
      address,
      area,
      city: city as any,
      phone,
      whatsapp,
      workingHours: {
        en: hoursEn,
        ar: hoursEn,
        fa: business.workingHours.fa || hoursEn
      },
      logoUrl: images[0] || business.logoUrl,
      coverUrl: images[1] || coverUrl || business.coverUrl,
      gallery: images.length > 0 ? images : business.gallery,
    };

    updateBusiness(updatedBiz);

    if (apiToken) {
      const cat = categories.find((c) => c.id === categoryId);
      try {
        const res = await apiFetch(`/api/directory/${business.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            businessName: name,
            category: subcatEn || cat?.name.en || business.subcategory.en,
            description: descEn,
            imageUrl: images[0] || business.logoUrl,
            coverUrl: images[1] || coverUrl || business.coverUrl,
            address,
            area,
            city,
            phone,
            whatsapp,
            website: business.website || '',
            workingHours: hoursEn,
          }),
        });
        if (res.ok) {
          await refreshDirectory();
        }
      } catch {
        console.warn('[ABN] Could not sync business profile to server.');
      }
    }

    setSaving(false);
    setSuccess(language === 'en' ? 'Profile updated successfully!' : 'تم تحديث البيانات بنجاح!');
    
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="space-y-4 animate-fade-in" id="portal-edit-form-section">
      <div className="flex items-center justify-between pb-2 border-b border-[#2D2319]/60">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full bg-[#191613] hover:bg-[#2D251C] transition-colors border border-[#2D2319]"
          >
            <ArrowRight className="w-4 h-4 text-gray-400 rotate-180" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-[#F4E3D7]">
              {language === 'en' ? 'Edit Business Profile' : 'تعديل بيانات العمل'}
            </h2>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5 rounded-3xl bg-[#13110E] border border-[#2D2319]" id="biz-edit-form">
        {success && <p className="p-3 bg-green-950/45 border border-green-900 text-green-300 text-xs rounded-xl">{success}</p>}

        <ImageUploadGrid
          id="edit-modal-image-upload"
          images={images}
          onChange={setImages}
          language={language}
          label={language === 'en' ? 'Upload Business/Service Images*' : 'رفع صور النشاط/الخدمة*'}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.businessName}*</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]"
              required
            />
          </div>

          <div>
            <label className="block text-xs app-label mb-1">{t.selectCategory}*</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full p-2.5 rounded-xl border text-xs app-field outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.subcategories}*</label>
          <input
            type="text"
            value={subcatEn}
            onChange={(e) => setSubcatEn(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.description}*</label>
          <textarea
            value={descEn}
            rows={3}
            onChange={(e) => setDescEn(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40 transition-colors resize-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.address}*</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.area}*</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs app-label mb-1">{t.city}*</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border text-xs app-field"
            >
              <option value="New York">{t.newyork}</option>
              <option value="Los Angeles">{t.losangeles}</option>
              <option value="Chicago">{t.chicago}</option>
              <option value="Houston">{t.houston}</option>
              <option value="Miami">{t.miami}</option>
              <option value="Dearborn">{t.dearborn}</option>
              <option value="Dallas">{t.dallas}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.phone}*</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t.whatsapp}</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.workingHours}*</label>
          <input
            type="text"
            value={hoursEn}
            onChange={(e) => setHoursEn(e.target.value)}
            placeholder="e.g. 9:00 AM – 9:00 PM"
            className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.coverUrl}</label>
          <input
            type="text"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold rounded-xl text-xs transition-all shadow-md mt-4 disabled:opacity-50"
        >
          {saving ? (language === 'en' ? 'Saving…' : 'جارٍ الحفظ…') : (language === 'en' ? 'Save Changes' : 'حفظ التعديلات')}
        </button>
      </form>
    </div>
  );
};
