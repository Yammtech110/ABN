import React, { useEffect, useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import {
  User,
  Briefcase,
  Shield,
  Bell,
  Lock,
  LogOut,
  ChevronRight,
  Eye,
  Zap,
} from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { NotificationCenterModal } from './NotificationCenterModal';
import { canManageListing, canPostJobs, getUserListing, listingKind } from '../utils/listingAccess';
import { countUnreadNotifications, filterNotificationsForUser } from '../utils/notifications';
import { isNativeApp } from '../lib/oauth';

interface AccountTabProps {
  onSwitchTab: (tabId: string) => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({ onSwitchTab }) => {
  const {
    language,
    theme,
    setTheme,
    currentUser,
    signOut,
    businesses,
    hiringActive,
    setHiringActive,
    notifications,
    notificationsLoading,
    notificationsError,
    refreshNotifications,
    markNotificationsAsRead,
    clearNotifications,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const myListing = getUserListing(currentUser, businesses);
  const canManage = canManageListing(myListing);
  const kind = listingKind(myListing);
  const isAdmin = currentUser?.role === 'admin';
  const canUseJobs = canPostJobs(myListing);
  const hiringEnabled = myListing ? (hiringActive[myListing.id] ?? false) : false;
  const [hiringBusy, setHiringBusy] = useState(false);

  const activeNotifs = filterNotificationsForUser(notifications, currentUser);
  const unreadCount = countUnreadNotifications(notifications, currentUser);

  useEffect(() => {
    refreshNotifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenNotificationCenter = () => {
    setShowNotificationsModal(true);
    void refreshNotifications();
    void markNotificationsAsRead();
  };

  const handleClearNotifications = async () => {
    if (!confirm('Clear all notifications from your inbox?')) return;
    await clearNotifications();
    await refreshNotifications();
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

  const handleHiringToggle = async () => {
    if (!myListing || !canUseJobs) return;
    setHiringBusy(true);
    try {
      await setHiringActive(myListing.id, !hiringEnabled);
    } finally {
      setHiringBusy(false);
    }
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
        <div className="p-4.5 rounded-3xl bg-[#13110E] border border-[#2D2319] flex items-center gap-3" id="signedin-profile-card">
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

        {isAdmin && isNativeApp() && (
          <div className="p-3.5 rounded-2xl bg-[#1C130D]/75 border border-[#3D2C1E]/50" id="admin-web-only-note">
            <p className="text-[11px] text-amber-400 leading-relaxed flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Admin tools are available on the web app only. Changes you make there sync to Android and iOS automatically.
              </span>
            </p>
          </div>
        )}

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
                      : 'Pending Approval'}
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

        {canUseJobs && myListing && (
          <>
            <div className="flex items-center justify-between p-4" id="row-hiring-active">
              <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
                <Briefcase className="w-4.5 h-4.5 text-[#FFA048]" />
                Hiring Active
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={hiringEnabled}
                disabled={hiringBusy}
                onClick={handleHiringToggle}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  hiringEnabled ? 'bg-[#FFA048]' : 'bg-stone-700'
                } ${hiringBusy ? 'opacity-60' : ''}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    hiringEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => onSwitchTab('job-management')}
              className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
              id="row-manage-jobs"
            >
              <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
                <Briefcase className="w-4.5 h-4.5 text-green-400" />
                Manage Job Postings
              </span>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFA048]" />
            </button>
          </>
        )}
        {/* Theme Selection Bar */}
        <div className="flex items-center justify-between p-4" id="row-theme-switch">
          <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
            <Eye className="w-4.5 h-4.5 text-[#FFA048]" />
            Theme Preference
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
        <NotificationCenterModal
          notifications={activeNotifs}
          loading={notificationsLoading}
          error={notificationsError}
          onClose={() => setShowNotificationsModal(false)}
          onRefresh={() => refreshNotifications()}
          onClearAll={handleClearNotifications}
        />
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
