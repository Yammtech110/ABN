import React, { useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import {
  User,
  Briefcase,
  Shield,
  Bell,
  Lock,
  Globe,
  LogOut,
  ChevronRight,
  Eye,
  Zap,
} from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { canManageListing, getUserListing, listingKind } from '../utils/listingAccess';

interface AccountTabProps {
  onSwitchTab: (tabId: string) => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({ onSwitchTab }) => {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    currentUser,
    signOut,
    businesses,
    notifications,
    markNotificationsAsRead,
    clearNotifications,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  // Modals for sub-sections
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const myListing = getUserListing(currentUser, businesses);
  const canManage = canManageListing(myListing);
  const kind = listingKind(myListing);
  const isAdmin = currentUser?.role === 'admin';

  const activeNotifs = notifications.filter(
    (n) => n.receiverRole === 'all' || n.receiverRole === currentUser?.role
  );
  const unreadCount = activeNotifs.filter((n) => !n.isRead).length;

  const handleOpenNotificationCenter = () => {
    setShowNotificationsModal(true);
    markNotificationsAsRead();
  };

  const roleBadgeLabel = () => {
    if (!currentUser) return '';
    if (currentUser.role === 'admin') return 'Admin';
    return t.roleUser || 'User';
  };

  const subscriptionLabel = () => {
    if (!myListing) return '';
    if (myListing.status !== 'active') return 'Suspended';
    return kind === 'service' ? '$30 Service Plan' : '$50 Business Plan';
  };

  if (!currentUser) return null;

  const handleSignOut = () => {
    void signOut();
  };

  if (isEditingProfile && !isAdmin) {
    return (
      <EditProfileModal onClose={() => setIsEditingProfile(false)} />
    );
  }

  return (
    <div className="space-y-6" id="account-tab-container">
      
      {/* Title block */}
      <div className="pb-1 border-b border-[#2D2319]" id="account-header">
        <h2 className="text-xl font-extrabold text-[#F4E3D7]">{t.account}</h2>
        <p className="text-[10px] text-gray-500 font-medium">Manage your profile and preferences</p>
      </div>

      {/* Signed-in profile card */}
      <div className={`flex flex-col ${isAdmin ? 'gap-0' : 'gap-4'}`}>
        <div className="p-4.5 rounded-3xl bg-[#13110E] border border-[#2D2319] flex items-center justify-between gap-3" id="signedin-profile-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#FFA048] text-black font-extrabold flex items-center justify-center border border-[#3A2E22]">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-black text-white truncate max-w-[160px]">{currentUser.name}</h3>
              <p className="text-[9px] text-gray-500 truncate max-w-[180px]">{currentUser.email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-green-400 font-bold flex items-center gap-1">
                  {currentUser.role === 'admin' && <Shield className="w-2.5 h-2.5 text-red-400" />}
                  Signed in ({roleBadgeLabel()})
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-1.5 rounded-full bg-[#201B15] text-[#FFA048] border border-[#3A2E22] hover:bg-[#2D2319] text-[10px] font-black tracking-tight transition-all"
            id="signedin-btn-signout"
          >
            Sign out
          </button>
        </div>

        {!isAdmin && (
          <>
        {/* Edit Profile — customer accounts only */}
          <button
            onClick={() => setIsEditingProfile(true)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/40 transition-all group"
            id="btn-edit-user-profile"
          >
            <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
              <User className="w-4 h-4 text-[#FFA048]" />
              {t.editProfile}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFA048]" />
          </button>
          
          {/* Active Business / Service listing metadata */}
          {myListing && (
            <div className={`p-4 rounded-3xl bg-[#13110E] border space-y-3 shadow-sm ${
              kind === 'service' ? 'border-blue-700/40' : 'border-[#2D2319]'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {kind === 'service'
                  ? <Zap className="w-4 h-4 text-blue-400" />
                  : <Briefcase className="w-4 h-4 text-[#FFA048]" />}
                <h4 className="text-xs font-black text-white">
                  {kind === 'service' ? 'Service Profile Metadata' : 'Business Profile Metadata'}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <span className="text-gray-500 block mb-0.5">
                    {kind === 'service' ? 'Service Name' : 'Business Name'}
                  </span>
                  <span className="text-white font-bold">{myListing.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Subscription Status</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block border ${
                    canManage
                      ? kind === 'service'
                        ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'
                        : 'bg-[#FFA048]/20 text-[#FFA048] border-[#FFA048]/30'
                      : 'bg-amber-900/30 text-amber-300 border-amber-700/40'
                  }`}>
                    {canManage
                      ? `${subscriptionLabel()} (Renews ${myListing.membershipExpiryDate})`
                      : (language === 'en' ? 'Pending Approval' : 'بانتظار الموافقة')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Reference ID</span>
                  <span className="text-white font-mono">{myListing.id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Category</span>
                  <span className="text-white font-bold">{myListing.subcategory.en}</span>
                </div>
              </div>
            </div>
          )}
            </>
          )}

      </div>

      {/* GLOBAL PREFERENCE & ACCESS ROWS — follows header card directly for admins */}
      <div className="py-2.5 rounded-3xl bg-[#13110E] border border-[#2D2319] divide-y divide-[#2D2319]/40" id="account-options-list">

        {canManage && (
          <button
            onClick={() => onSwitchTab('portal-management')}
            className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
            id="row-manage-listing"
          >
            <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
              {kind === 'service'
                ? <Zap className="w-4.5 h-4.5 text-blue-400" />
                : <Briefcase className="w-4.5 h-4.5 text-[#FFA048]" />}
              {kind === 'service' ? t.manageService : t.manageBusiness}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFA048]" />
          </button>
        )}
        {/* Language Selection Bar (Value-Added localization tool) */}
        <div className="flex items-center justify-between p-4" id="row-language-switch">
          <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
            <Globe className="w-4.5 h-4.5 text-[#FFA048]" />
            {t.languageSelection}
          </span>
          <div className="flex gap-1.5 p-1 rounded-xl bg-[#0F0E0C] border border-[#2D2319]">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                language === 'en' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('ar')}
              className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                language === 'ar' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              عربي
            </button>
            <button
              onClick={() => setLanguage('fa')}
              className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                language === 'fa' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              فارسی
            </button>
          </div>
        </div>

        {/* Theme Selection Bar */}
        <div className="flex items-center justify-between p-4" id="row-theme-switch">
          <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
            <Eye className="w-4.5 h-4.5 text-[#FFA048]" />
            {language === 'en' ? 'Theme Preference' : 'تفضيل المظهر'}
          </span>
          <div className="flex gap-1.5 p-1 rounded-xl bg-[#0F0E0C] border border-[#2D2319]">
            <button
              onClick={() => setTheme('light')}
              className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                theme === 'light' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                theme === 'dark' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                theme === 'system' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              System
            </button>
          </div>
        </div>

        {/* Notifications list trigger */}
        <button
          onClick={handleOpenNotificationCenter}
          className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
          id="row-notif-trigger"
        >
          <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
            <Bell className="w-4.5 h-4.5 text-[#FFA048]" />
            {t.notifications}
            {unreadCount > 0 && (
              <span className="p-0.5 px-1.5 rounded-full bg-red-500 text-white text-[8px] font-bold">
                {unreadCount} NEW
              </span>
            )}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
        </button>

        {/* Privacy modal trigger */}
        <button
          onClick={() => setShowPrivacyModal(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
          id="row-privacy-trigger"
        >
          <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
            <Lock className="w-4.5 h-4.5 text-[#FFA048]" />
            {t.privacy}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
        </button>
      </div>

      {/* SIGN OUT LINK (As printed in Screenshot #5) */}
      <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 p-4 px-5 rounded-2xl border border-red-500/10 bg-red-950/15 hover:bg-red-950/25 text-red-400 font-semibold text-xs transition-colors"
          id="btn-account-danger-signout"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          {t.signOut}
        </button>

      {/* SUB-MODAL 1: SYSTEM NOTIFICATIONS POPUP */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-[#13110E] border border-[#2D2319] p-6 text-[#F4E3D7]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#FFA048] flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {t.notifications}
                {activeNotifs.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#FFA048]/15 text-[#FFA048] rounded-full font-bold">{activeNotifs.length}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {activeNotifs.length > 0 && (
                  <button
                    onClick={clearNotifications}
                    className="text-[9px] px-2 py-1 bg-red-950/40 text-red-400 border border-red-900/40 rounded-lg font-bold hover:bg-red-950/70 transition-colors"
                    id="notif-btn-clear-all"
                  >
                    {language === 'en' ? 'Clear All' : 'مسح الكل'}
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationsModal(false)}
                  className="p-1.5 rounded-full hover:bg-[#201B15] text-gray-400 hover:text-[#FFA048] transition-colors"
                  id="notif-modal-close"
                >
                  <span className="text-sm">✕</span>
                </button>
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin" id="notif-modal-list">
              {activeNotifs.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">{language === 'en' ? 'No notifications yet.' : 'لا توجد إشعارات حتى الآن.'}</p>
                </div>
              ) : (
                activeNotifs.map((n) => {
                  const isExpiry = n.title.includes('Expir');
                  const isLogin = n.title.includes('Login');
                  const dotColor = isExpiry ? 'bg-amber-500' : isLogin ? 'bg-green-500' : 'bg-[#FFA048]';
                  return (
                    <div key={n.id} className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${n.isRead ? 'bg-[#0F0E0C] border-[#2D2319]/50' : 'bg-[#191613] border-[#FFA048]/20'}`}>
                      <div className="flex items-center justify-between text-[9px]">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ${!n.isRead ? 'animate-pulse' : ''}`} />
                          <span className="text-gray-500">{n.date}</span>
                        </div>
                        <span className="font-bold uppercase tracking-wider text-[#FFA048] bg-[#FFA048]/10 px-1.5 py-0.5 rounded">
                          {n.receiverRole === 'all' ? 'Platform' : n.receiverRole}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white">{n.title}</h4>
                      <p className="text-[10px] text-gray-400 leading-relaxed">{n.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: PRIVACY GUIDELINE STATEMENT */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-[#13110E] border border-[#2D2319] p-6 text-[#F4E3D7]">
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-xs text-gray-500 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-sm font-black uppercase tracking-wider text-[#FFA048] mb-3 flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#FFA048]" /> Privacy & Security Policy
            </h3>

            <div className="text-xs text-gray-400 leading-relaxed font-sans space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              <p>
                <strong>Community Directory Model:</strong> The Ahle Bait Network (ABN) Business Directory application strictly operates as an index to discover verified local Shia-owned shops and professionals.
              </p>
              <p>
                <strong>No Intermediary Transactions:</strong> To guarantee absolute security, the system does not processes credit cards for services or collect direct user transaction streams. All communication happens outside the platform (direct calling or WhatsApp deep-linking).
              </p>
              <p>
                <strong>Data Encryption:</strong> All account emails and telephone details are protected using browser key hashes. Your listings are protected and can only be altered by you or platform administrators.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
