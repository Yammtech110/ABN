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
  FileText,
  HelpCircle,
  Mail,
  Trash2,
  ScrollText,
  BookOpen,
  CreditCard,
} from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { NotificationCenterModal } from './NotificationCenterModal';
import { LegalDocModal } from './LegalDocModal';
import { canManageListing, canPostJobs, getUserListing, listingKind } from '../utils/listingAccess';
import { countUnreadNotifications, filterNotificationsForUser } from '../utils/notifications';
import { isNativeApp } from '../lib/oauth';
import { LegalDocId, SUPPORT_MAILTO } from '../data/legalContent';

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
    deleteAccount,
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
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const handleDeleteAccount = async () => {
    if (isAdmin) {
      alert('Admin accounts cannot be self-deleted.');
      return;
    }
    const ok = confirm(
      'Permanently delete your ABN account and personal data? This cannot be undone.',
    );
    if (!ok) return;
    const confirmWord = prompt('Type DELETE to confirm:');
    if (confirmWord !== 'DELETE') return;
    setDeleteBusy(true);
    const result = await deleteAccount();
    setDeleteBusy(false);
    if (!result.success) {
      alert(result.error || 'Could not delete account.');
    }
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

        {/* Legal & support */}
        {(
          [
            { id: 'privacy' as const, label: 'Privacy Policy', Icon: Lock },
            { id: 'terms' as const, label: 'Terms & Conditions', Icon: FileText },
            { id: 'guidelines' as const, label: 'Community Guidelines', Icon: BookOpen },
            { id: 'subscription' as const, label: 'Subscription Terms', Icon: CreditCard },
            { id: 'disclaimers' as const, label: 'Business & Job Disclaimers', Icon: ScrollText },
            { id: 'faq' as const, label: 'FAQ', Icon: HelpCircle },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setLegalDoc(id)}
            className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
            id={`row-legal-${id}`}
          >
            <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
              <Icon className="w-4.5 h-4.5 text-[#FFA048]" />
              {label}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
          </button>
        ))}

        <a
          href={SUPPORT_MAILTO}
          className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
          id="row-contact-support"
        >
          <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
            <Mail className="w-4.5 h-4.5 text-[#FFA048]" />
            Contact Support
          </span>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
        </a>
      </div>

      {/* SIGN OUT */}
      <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 p-4 px-5 rounded-2xl border border-red-500/10 bg-red-950/15 hover:bg-red-950/25 text-red-400 font-semibold text-xs transition-colors"
          id="btn-account-danger-signout"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          {t.signOut}
        </button>

      {!isAdmin && (
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleteBusy}
          className="w-full flex items-center gap-3 p-4 px-5 rounded-2xl border border-red-500/20 bg-red-950/25 hover:bg-red-950/40 text-red-300 font-semibold text-xs transition-colors disabled:opacity-60"
          id="btn-account-delete"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          {deleteBusy ? 'Deleting…' : 'Delete Account'}
        </button>
      )}

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

      {legalDoc && <LegalDocModal docId={legalDoc} onClose={() => setLegalDoc(null)} />}

    </div>
  );
};
