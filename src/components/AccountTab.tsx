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
import { canManageListing, canPostJobs, getUserListing, listingKind } from '../utils/listingAccess';
import { countUnreadNotifications, filterNotificationsForUser } from '../utils/notifications';
import { isNativeApp } from '../lib/oauth';
import { LegalDocId, SUPPORT_MAILTO } from '../data/legalContent';

interface AccountTabProps {
  onSwitchTab: (tabId: string) => void;
  onOpenLegal: (docId: LegalDocId) => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({ onSwitchTab, onOpenLegal }) => {
  const {
    language,
    theme,
    setTheme,
    currentUser,
    signOut,
    deleteAccount,
    deleteMyListing,
    businesses,
    hiringActive,
    setHiringActive,
    notifications,
    refreshNotifications,
    markNotificationsAsRead,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteListingBusy, setDeleteListingBusy] = useState(false);

  const myListing = getUserListing(currentUser, businesses);
  const canManage = canManageListing(myListing);
  const kind = listingKind(myListing);
  const isAdmin = currentUser?.role === 'admin';
  const canUseJobs = canPostJobs(myListing);
  const hiringEnabled = myListing ? (hiringActive[myListing.id] ?? false) : false;
  const [hiringBusy, setHiringBusy] = useState(false);

  const unreadCount = countUnreadNotifications(notifications, currentUser);

  useEffect(() => {
    refreshNotifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenNotificationCenter = () => {
    void refreshNotifications();
    void markNotificationsAsRead();
    onSwitchTab('notifications');
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

  const handleDeleteListing = async () => {
    if (!myListing) return;
    const label = kind === 'service' ? 'service provider listing' : 'business listing';
    const ok = confirm(
      `Delete your ${label} "${myListing.name}"? This also removes its job postings from the directory. This cannot be undone.`,
    );
    if (!ok) return;
    const confirmWord = prompt('Type DELETE to confirm:');
    if (confirmWord !== 'DELETE') return;
    setDeleteListingBusy(true);
    const result = await deleteMyListing(myListing.id);
    setDeleteListingBusy(false);
    if (!result.success) {
      alert(result.error || 'Could not delete listing.');
      return;
    }
    alert(kind === 'service' ? 'Service listing deleted.' : 'Business listing deleted.');
  };

  if (isEditingProfile && !isAdmin) {
    return (
      <EditProfileModal
        onClose={() => setIsEditingProfile(false)}
      />
    );
  }

  return (
    <div className="space-y-6" id="account-tab-container">
      <div className="pb-1 border-b border-[#2D2319]" id="account-header">
        <h2 className="text-xl font-extrabold text-[#F4E3D7]">{t.account}</h2>
        <p className="text-[10px] text-gray-500 font-medium">Manage your profile and preferences.</p>
      </div>

      <div className={`flex flex-col ${isAdmin ? 'gap-0' : 'gap-4'}`}>
        <div className="p-4.5 rounded-3xl bg-[#13110E] border border-[#2D2319] flex items-center gap-3" id="signedin-profile-card">
          <div className="w-12 h-12 rounded-2xl bg-[#201B15] border border-[#2D2319] flex items-center justify-center text-[#FFA048]">
            {isAdmin ? <Shield className="w-6 h-6" /> : kind === 'service' ? <Zap className="w-6 h-6 text-blue-400" /> : <User className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{currentUser.name}</h3>
            <p className="text-[10px] text-gray-500 truncate">{currentUser.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border account-role-badge ${
                isAdmin
                  ? 'account-role-badge-admin bg-[#FFA048]/15 text-[#FFA048] border-[#FFA048]/30'
                  : kind === 'service'
                    ? 'account-role-badge-service bg-blue-900/40 text-blue-200 border-blue-600/50'
                    : 'account-role-badge-user bg-[#201B15] text-gray-400 border-[#2D2319]'
              }`}>
                {roleBadgeLabel()}
              </span>
              {subscriptionLabel() && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#201B15] text-gray-400 border border-[#2D2319] account-plan-badge">
                  {subscriptionLabel()}
                </span>
              )}
            </div>
          </div>
        </div>

        {isAdmin && isNativeApp() && (
          <div className="p-3.5 rounded-2xl bg-[#1C130D]/75 border border-[#3D2C1E]/50" id="admin-web-only-note">
            <p className="text-[10px] text-[#C9A887] leading-relaxed">
              Admin tools are available on the web app only. Changes you make there sync to Android and iOS automatically.
            </p>
          </div>
        )}

        {!isAdmin && (
          <button
            type="button"
            onClick={() => setIsEditingProfile(true)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/40 transition-colors"
            id="btn-edit-user-profile"
          >
            <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
              <Eye className="w-4.5 h-4.5 text-[#FFA048]" />
              Edit Profile
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      <div className="py-2.5 rounded-3xl bg-[#13110E] border border-[#2D2319] divide-y divide-[#2D2319]/40" id="account-options-list">
        {canManage && (
          <button
            type="button"
            onClick={() => onSwitchTab('portal-management')}
            className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
            id="row-manage-listing"
          >
            <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
              {kind === 'service' ? <Zap className="w-4.5 h-4.5 text-blue-400" /> : <Briefcase className="w-4.5 h-4.5 text-[#FFA048]" />}
              {kind === 'service' ? 'Manage Service' : 'Manage Business'}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
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
                disabled={hiringBusy}
                onClick={async () => {
                  setHiringBusy(true);
                  await setHiringActive(myListing.id, !hiringEnabled);
                  setHiringBusy(false);
                }}
                className={`app-toggle relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                  hiringEnabled ? 'app-toggle-on' : 'app-toggle-off'
                }`}
                aria-pressed={hiringEnabled}
                aria-label="Hiring Active"
                id="btn-hiring-toggle"
              >
                <span
                  className={`app-toggle-knob absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
                    hiringEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('job-management')}
              className="w-full flex items-center justify-between p-4 hover:bg-stone-900/10 transition-colors group"
              id="row-manage-jobs"
            >
              <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
                <Briefcase className="w-4.5 h-4.5 text-[#FFA048]" />
                Manage Jobs
              </span>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
            </button>
          </>
        )}

        <div className="flex items-center justify-between p-4" id="row-theme-switch">
          <span className="flex items-center gap-3 text-xs text-gray-300 font-semibold">
            <Eye className="w-4.5 h-4.5 text-[#FFA048]" />
            Theme
          </span>
          <div className="flex rounded-xl bg-[#0F0E0C] border border-[#2D2319] p-0.5">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                theme === 'light' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                theme === 'dark' ? 'bg-[#FFA048] text-black' : 'text-gray-400'
              }`}
            >
              Dark
            </button>
          </div>
        </div>

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
            onClick={() => onOpenLegal(id)}
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

      <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 p-4 px-5 rounded-2xl border border-red-500/10 bg-red-950/15 hover:bg-red-950/25 text-red-400 font-semibold text-xs transition-colors"
          id="btn-account-danger-signout"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          {t.signOut}
        </button>

      {myListing && (
        <button
          type="button"
          onClick={handleDeleteListing}
          disabled={deleteListingBusy}
          className="w-full flex items-center gap-3 p-4 px-5 rounded-2xl border border-red-500/20 bg-red-950/25 hover:bg-red-950/40 text-red-300 font-semibold text-xs transition-colors disabled:opacity-60"
          id="btn-account-delete-listing"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          {deleteListingBusy
            ? 'Deleting…'
            : kind === 'service'
              ? 'Delete Service Provider'
              : 'Delete Business'}
        </button>
      )}

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
    </div>
  );
};
