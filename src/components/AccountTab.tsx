import React, { useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import {
  User,
  Briefcase,
  Shield,
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
  Ban,
} from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { canManageListing, canPostJobs, getUserListing, isPendingSubmission, listingKind } from '../utils/listingAccess';
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
    blockedUsers,
    unblockListingOwner,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteListingBusy, setDeleteListingBusy] = useState(false);
  const [unblockBusyId, setUnblockBusyId] = useState<string | null>(null);

  const myListing = getUserListing(currentUser, businesses);
  const canManage = canManageListing(myListing);
  const listingPending = Boolean(myListing && isPendingSubmission(myListing));
  const kind = listingKind(myListing);
  const isAdmin = currentUser?.role === 'admin';
  const canUseJobs = canPostJobs(myListing);
  const hiringEnabled = myListing ? (hiringActive[myListing.id] ?? false) : false;
  const [hiringBusy, setHiringBusy] = useState(false);

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
        : 'bg-[#1E1915] text-[#8E8E8E] border-[#2B231D]';

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
    <div className="min-h-full space-y-6 bg-[#0D0906]" id="account-tab-container">
      <div className="pb-1 border-b border-[#2B231D]" id="account-header">
        <h2 className="text-xl font-extrabold text-white">{t.account}</h2>
        <p className="text-[10px] text-[#8E8E8E] font-medium">Manage your profile and preferences.</p>
      </div>

      <div className={`flex flex-col ${isAdmin ? 'gap-0' : 'gap-4'}`}>
        <div className="p-4.5 rounded-3xl bg-[#171310] border border-[#2B231D] flex items-center gap-3" id="signedin-profile-card">
          <div className="w-12 h-12 rounded-2xl bg-[#1E1915] border border-[#2B231D] flex items-center justify-center text-[#F08C32]">
            {isAdmin ? <Shield className="w-6 h-6" /> : kind === 'service' ? <Zap className="w-6 h-6 text-orange-400" /> : <User className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{currentUser.name}</h3>
            <p className="text-[10px] text-[#8E8E8E] truncate">{currentUser.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border account-role-badge ${
                isAdmin
                  ? 'account-role-badge-admin bg-[#FF9E47]/15 text-[#F08C32] border-[#F08C32]/30'
                  : kind === 'service'
                    ? 'account-role-badge-service bg-orange-900/40 text-orange-300 border-orange-700/40'
                    : 'account-role-badge-user bg-[#1E1915] text-[#8E8E8E] border-[#2B231D]'
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

        {!isAdmin && (
          <button
            type="button"
            onClick={() => setIsEditingProfile(true)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#171310] border border-[#2B231D] hover:border-[#F08C32]/40 transition-colors"
            id="btn-edit-user-profile"
          >
            <span className="flex items-center gap-3 text-xs text-white font-semibold">
              <Eye className="w-4.5 h-4.5 text-[#F08C32]" />
              Edit Profile
            </span>
            <ChevronRight className="w-4 h-4 text-[#8E8E8E]" />
          </button>
        )}

        {myListing && listingPending && (
          <div
            className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-700/40"
            id="account-listing-pending-banner"
          >
            <p className="text-[11px] font-bold text-amber-200 mb-1">
              {kind === 'service' ? 'Service listing pending public listing' : 'Business listing pending public listing'}
            </p>
            <p className="text-[10px] text-amber-100/80 leading-relaxed">
              Admin still needs to approve before your listing appears in public search. You can already manage your listing, photos, hiring, and jobs from Profile.
            </p>
          </div>
        )}
      </div>

      <div className="py-2.5 rounded-3xl bg-[#171310] border border-[#2B231D] divide-y divide-[#2B231D]/40" id="account-options-list">
        {myListing && (
          <button
            type="button"
            onClick={() => onSwitchTab('portal-management')}
            className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
            id="row-manage-listing"
          >
            <span className="flex items-center gap-3 text-xs text-white font-semibold min-w-0">
              {kind === 'service' ? (
                <Zap className="w-4.5 h-4.5 text-orange-400 shrink-0" />
              ) : (
                <Briefcase className="w-4.5 h-4.5 text-[#F08C32] shrink-0" />
              )}
              <span className="flex flex-col items-start gap-0.5 min-w-0">
                <span>{kind === 'service' ? 'Manage Service' : 'Manage Business'}</span>
                {listingPending ? (
                  <span className="text-[9px] font-medium text-amber-300">Pending public approval</span>
                ) : (
                  <span className="text-[9px] font-medium text-[#8E8E8E] truncate max-w-[14rem]">{myListing.name}</span>
                )}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#8E8E8E] group-hover:text-white shrink-0" />
          </button>
        )}

        {canUseJobs && myListing && (
          <>
            <div className="flex items-center justify-between p-4" id="row-hiring-active">
              <span className="flex items-center gap-3 text-xs text-white font-semibold">
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
              <span className="flex items-center gap-3 text-xs text-white font-semibold">
                <Briefcase className="w-4.5 h-4.5 text-[#F08C32]" />
                Manage Jobs
              </span>
              <ChevronRight className="w-4 h-4 text-[#8E8E8E] group-hover:text-white" />
            </button>
          </>
        )}

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
            <span className="flex items-center gap-3 text-xs text-white font-semibold">
              <Icon className="w-4.5 h-4.5 text-[#F08C32]" />
              {label}
            </span>
            <ChevronRight className="w-4 h-4 text-[#8E8E8E] group-hover:text-white" />
          </button>
        ))}

        <a
          href={SUPPORT_MAILTO}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1E1915] transition-colors group"
          id="row-contact-support"
        >
          <span className="flex items-center gap-3 text-xs text-white font-semibold min-w-0">
            <Mail className="w-4.5 h-4.5 text-[#F08C32] shrink-0" />
            <span className="min-w-0 flex flex-col items-start gap-0.5">
              <span>Contact Support</span>
              <span className="text-[10px] font-medium text-[#F08C32] truncate">{SUPPORT_EMAIL}</span>
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-[#8E8E8E] group-hover:text-white shrink-0" />
        </a>
      </div>

      {blockedUsers.length > 0 && (
        <div
          className="p-4 rounded-3xl bg-[#171310] border border-[#2B231D] space-y-3"
          id="account-blocked-owners"
        >
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-[#F08C32]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F08C32]">
              Blocked owners
            </h3>
          </div>
          <p className="text-[10px] text-[#8E8E8E] leading-relaxed">
            Their listings stay hidden from your directory until you unblock them.
          </p>
          <ul className="space-y-2">
            {blockedUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#1E1915] border border-[#2B231D]"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {u.name || u.email || 'Blocked user'}
                  </p>
                  {u.email && u.name ? (
                    <p className="text-[10px] text-[#8E8E8E] truncate">{u.email}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={unblockBusyId === u.id}
                  onClick={async () => {
                    setUnblockBusyId(u.id);
                    const result = await unblockListingOwner(u.id);
                    setUnblockBusyId(null);
                    if (!result.success) {
                      alert(result.error || 'Could not unblock.');
                    }
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#F08C32] border border-[#F08C32]/35 hover:bg-[#FF9E47]/10 disabled:opacity-50"
                  id={`btn-unblock-${u.id}`}
                >
                  {unblockBusyId === u.id ? '…' : 'Unblock'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
