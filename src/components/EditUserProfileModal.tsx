import React, { useState } from 'react';
import { ArrowLeft, Save, User } from 'lucide-react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';

interface EditUserProfileModalProps {
  onClose: () => void;
}

export const EditUserProfileModal: React.FC<EditUserProfileModalProps> = ({ onClose }) => {
  const { language, currentUser, updateUserProfile } = useDirectory();
  const t = TRANSLATIONS[language];

  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      setError(result.error || (language === 'en' ? 'Could not save profile.' : 'تعذر حفظ الملف الشخصي.'));
      return;
    }

    setSuccess(t.profileUpdated);
    setTimeout(onClose, 1200);
  };

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
            <User className="w-4 h-4 text-[#FFA048]" />
            {t.editProfile}
          </h2>
          <p className="text-[10px] text-gray-500">{t.accountSettings}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5 rounded-2xl bg-[#13110E] border border-[#2D2319]">
        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-2.5">{error}</p>
        )}
        {success && (
          <p className="text-xs text-green-400 bg-green-950/30 border border-green-900/50 rounded-xl p-2.5">{success}</p>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.email}</label>
          <input
            type="email"
            value={currentUser?.email || ''}
            readOnly
            className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-gray-500 outline-none"
            id="edit-profile-email"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.name}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none"
            id="edit-profile-name"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{t.phone}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs text-[#F4E3D7] outline-none"
            id="edit-profile-phone"
          />
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
    </div>
  );
};
