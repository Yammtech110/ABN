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
  Heart,
} from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { canManageListing, canPostJobs, getUserListing, listingKind } from '../utils/listingAccess';
import { countUnreadNotifications, filterNotificationsForUser } from '../utils/notifications';
import { isNativeApp } from '../lib/oauth';
import { LegalDocId, SUPPORT_EMAIL, SUPPORT_MAILTO } from '../data/legalContent';

interface AccountTabProps {
  onSwitchTab: (tabId: string) => void;
  onOpenLegal: (docId: LegalDocId) => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({ onSwitchTab, onOpenLegal }) => {
  const {
    language,
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
    if (myListing.status === 'pending' || !myListing.isVerified) return 'Pending Approval';
    if (myListing.status === 'suspended') return 'Suspended';
    if (myListing.status !== 'active') return 'Pending Approval';
    return kind === 'service' ? '$30 Service Plan' : '$50 Business Plan';
  };

  const planBadge = subscriptionLabel();
  const planBadgeClass =
    planBadge === 'Suspended'
      ? 'account-plan-suspended bg-red-950/40 text-red-300 border-red-700/40'
      : planBadge === 'Pending Approval'
        ? 'account-plan-pending bg-amber-950/30 text-amber-300 border-amber-700/40'
        : 'bg-[#1E1915] text-gray-400 border-[#2B231D]';

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
      <div className="pb-1 border-b border-[#2B231D]" id="account-header">
        <h2 className="text-xl font-extrabold text-[#FFFFFF]">{t.account}</h2>
        <p className="text-[10px] text-gray-500 font-medium">Manage your profile and preferences.</p>
      </div>

      <div className={`flex flex-col ${isAdmin ? 'gap-0' : 'gap-4'}`}>
        <div className="p-4.5 rounded-3xl bg-[#171310] border border-[#2B231D] flex items-center gap-3" id="signedin-profile-card">
          <div className="w-12 h-12 rounded-2xl bg-[#1E1915] border border-[#2B231D] flex items-center justify-center text-[#F08C32]">
            {isAdmin ? <Shield className="w-6 h-6" /> : kind === 'service' ? <Zap className="w-6 h-6 text-orange-400" /> : <User className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#FFFFFF] truncate">{currentUser.name}</h3>
            <p className="text-[10px] text-gray-500 truncate">{currentUser.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border account-role-badge ${
                isAdmin
                  ? 'account-role-badge-admin bg-[#FF9E47]/15 text-[#F08C32] border-[#F08C32]/30'
                  : kind === 'service'
                    ? 'account-role-badge-service bg-orange-50 text-orange-700 border-orange-200'
                    : 'account-role-badge-user bg-[#1E1915] text-gray-400 border-[#2B231D]'
              }`}>
                {roleBadgeLabel()}
              </span>
              {planBadge && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border account-plan-badge ${planBadgeClass}`}>
                  {planBadge}
                </span>
              )}
            </div>
          </div>
        </div>

        {isAdmin && isNativeApp() && (
          <div className="p-3.5 rounded-2xl bg-orange-50/75 border border-orange-200/50" id="admin-web-only-note">
            <p className="text-[10px] text-[#CFCFCF] leading-relaxed">
              Admin tools are available on the web app only. Changes you make there sync to Android and iOS automatically.
            </p>
          </div>
        )}

        {!isAdmin && (
          <button
            type="button"
            onClick={() => setIsEditingProfile(true)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#171310] border border-[#2B231D] hover:border-[#F08C32]/40 transition-colors"
            id="btn-edit-user-profile"
          >
            <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold">
              <Eye className="w-4.5 h-4.5 text-[#F08C32]" />
              Edit Profile
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      <div className="py-2.5 rounded-3xl bg-[#171310] border border-[#2B231D] divide-y divide-[#2B231D]/40" id="account-options-list">
        {canManage && (
          <button
            type="button"
            onClick={() => onSwitchTab('portal-management')}
            className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
            id="row-manage-listing"
          >
            <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold">
              {kind === 'service' ? <Zap className="w-4.5 h-4.5 text-orange-400" /> : <Briefcase className="w-4.5 h-4.5 text-[#F08C32]" />}
              {kind === 'service' ? 'Manage Service' : 'Manage Business'}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFFFFF]" />
          </button>
        )}

        {canUseJobs && myListing && (
          <>
            <div className="flex items-center justify-between p-4" id="row-hiring-active">
              <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold">
                <Briefcase className="w-4.5 h-4.5 text-[#F08C32]" />
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
              className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
              id="row-manage-jobs"
            >
              <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold">
                <Briefcase className="w-4.5 h-4.5 text-[#F08C32]" />
                Manage Jobs
              </span>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFFFFF]" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onSwitchTab('saved')}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
          id="row-saved"
        >
          <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold">
            <Heart className="w-4.5 h-4.5 text-[#F08C32]" />
            {t.saved || 'Saved'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFFFFF]" />
        </button>

        <button
          onClick={handleOpenNotificationCenter}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
          id="row-notif-trigger"
        >
          <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold">
            <Bell className="w-4.5 h-4.5 text-[#F08C32]" />
            {t.notifications}
            {unreadCount > 0 && (
              <span className="p-0.5 px-1.5 rounded-full bg-red-500 text-white text-[8px] font-bold">
                {unreadCount} NEW
              </span>
            )}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFFFFF]" />
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
            className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
            id={`row-legal-${id}`}
          >
            <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold">
              <Icon className="w-4.5 h-4.5 text-[#F08C32]" />
              {label}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFFFFF]" />
          </button>
        ))}

        <a
          href={SUPPORT_MAILTO}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
          id="row-contact-support"
        >
          <span className="flex items-center gap-3 text-xs text-[#FFFFFF] font-semibold min-w-0">
            <Mail className="w-4.5 h-4.5 text-[#F08C32] shrink-0" />
            <span className="min-w-0 flex flex-col items-start gap-0.5">
              <span>Contact Support</span>
              <span className="text-[10px] font-medium text-[#F08C32]/90 truncate">{SUPPORT_EMAIL}</span>
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFFFFF] shrink-0" />
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
