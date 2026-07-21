import React, { useEffect, useMemo, useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { apiFetch } from '../lib/api';
import { TRANSLATIONS } from '../data/translations';
import { BusinessThumbnail } from './BusinessThumbnail';
import { AdminListingPhotos } from './AdminListingPhotos';
import {
  ShieldAlert,
  Settings,
  XCircle,
  CheckCircle,
  Plus,
  Trash,
  Sliders,
  DollarSign,
  Users,
  Grid,
  AlertTriangle,
  Award,
  Search,
  Check,
  X,
  Briefcase,
} from 'lucide-react';
import { Business, Category, Job } from '../types';
import {
  calculateRevenueFromPayments,
  formatUsd,
  getActivePaidListings,
  getListingMonthlyFee,
  isListingOnFreeTrial,
  listingNeedsPayment,
} from '../utils/platformStats';
import { isPendingSubmission } from '../utils/listingAccess';
import { isNativeApp } from '../lib/oauth';

export const AdminPanelTab: React.FC = () => {
  const {
    language,
    currentUser,
    businesses,
    categories,
    payments,
    addCategory,
    removeCategory,
    refreshCategories,
    updateBusiness,
    removeBusiness,
    apiToken,
    refreshDirectory,
    refreshPayments,
    renewMembership,
    refreshNotifications,
    refreshJobs,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  // Selected administrative segment
  const [adminTab, setAdminTab] = useState<'biz' | 'pay' | 'jobs' | 'cat' | 'users'>('biz');
  const [bizFilter, setBizFilter] = useState<'all' | 'active' | 'pending' | 'expired' | 'submissions'>('all');
  const [vendorSearch, setVendorSearch] = useState('');

  // Category insertion state
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatGroup, setNewCatGroup] = useState<'Shops' | 'Services' | 'Professionals' | 'Food'>('Shops');
  const [catSuccess, setCatSuccess] = useState('');
  const [catError, setCatError] = useState('');
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [catsLoading, setCatsLoading] = useState(false);

  type DuesLedgerRow = {
    id: string;
    businessId: string;
    businessName: string;
    amount: number;
    date: string;
    expires: string;
    refNo: string;
    status: 'paid' | 'trial' | 'unpaid';
  };
  const [duesLedger, setDuesLedger] = useState<DuesLedgerRow[]>([]);
  const [duesStats, setDuesStats] = useState({ totalRevenue: 0, transactionCount: 0, activeListings: 0 });
  const [duesLoading, setDuesLoading] = useState(false);
  const [duesError, setDuesError] = useState('');
  const [vettingLoading, setVettingLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [adminToast, setAdminToast] = useState('');

  // User management — loaded from API
  type AdminUserRow = {
    id: string;
    email: string;
    name: string;
    role: string;
    roleLabel: string;
    listingName: string | null;
    listingStatus: string;
    isBlocked: boolean;
  };
  const [directoryUsers, setDirectoryUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  type IntegrityReportRow = {
    id: string;
    businessId: string;
    businessName: string;
    reporterName: string;
    reporterEmail: string;
    reason: string;
    status: 'open' | 'resolved';
    date: string;
    resolvedAt: string | null;
  };
  const [integrityReports, setIntegrityReports] = useState<IntegrityReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportFilter, setReportFilter] = useState<'all' | 'open' | 'resolved'>('open');

  const [adminJobs, setAdminJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Is current logged in user an admin?
  const isAdmin = currentUser?.role === 'admin';

  // Always pull latest submissions when admin opens this panel
  useEffect(() => {
    if (isAdmin) {
      refreshDirectory(currentUser);
      refreshPayments(apiToken, 'admin');
      loadIntegrityReports();
    }
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDirectoryUsers = async () => {
    if (!apiToken) return;
    setUsersLoading(true);
    setUsersError('');
    try {
      const res = await apiFetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setUsersError(data.error || 'Failed to load users.');
        setDirectoryUsers([]);
        return;
      }
      setDirectoryUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setUsersError('Cannot reach server. Make sure the backend is running.');
      setDirectoryUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && adminTab === 'users') {
      loadDirectoryUsers();
      loadIntegrityReports();
    }
  }, [isAdmin, adminTab, apiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAdminJobs = async () => {
    if (!apiToken) return;
    setJobsLoading(true);
    setJobsError('');
    try {
      const res = await apiFetch('/api/jobsboard/all', {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setJobsError(data.error || 'Failed to load job postings.');
        setAdminJobs([]);
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setAdminJobs(
        rows.map((j: Record<string, unknown>) => ({
          id:              String(j.id ?? ''),
          businessId:      String(j.businessId ?? ''),
          businessName:    String(j.businessName ?? ''),
          businessLogoUrl: String(j.businessLogoUrl ?? ''),
          title:           String(j.title ?? ''),
          category:        String(j.category ?? 'Others') as Job['category'],
          requirements:    String(j.requirements ?? ''),
          salaryMin:       Number(j.salaryMin ?? 0),
          salaryMax:       Number(j.salaryMax ?? 0),
          hiringEmail:     String(j.hiringEmail ?? ''),
          postedDate:      String(j.postedDate ?? '').slice(0, 10),
          isActive:        Boolean(j.isActive ?? true),
        })),
      );
    } catch {
      setJobsError('Cannot reach server. Make sure the backend is running.');
      setAdminJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && adminTab === 'jobs') loadAdminJobs();
  }, [isAdmin, adminTab, apiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAdmin || adminTab !== 'cat') return;
    setCatsLoading(true);
    refreshCategories()
      .catch(() => setCatError('Could not load categories from server.'))
      .finally(() => setCatsLoading(false));
  }, [isAdmin, adminTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadIntegrityReports = async () => {
    if (!apiToken) return;
    setReportsLoading(true);
    setReportsError('');
    try {
      const res = await apiFetch('/api/reports', {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setReportsError(data.error || 'Failed to load reports.');
        setIntegrityReports([]);
        return;
      }
      setIntegrityReports(Array.isArray(data.reports) ? data.reports : []);
    } catch {
      setReportsError('Cannot reach server. Make sure the backend is running.');
      setIntegrityReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  const resolveReport = async (report: IntegrityReportRow) => {
    if (!apiToken) return;
    if (!confirm(`Mark this report about "${report.businessName}" as resolved?`)) return;

    try {
      const res = await apiFetch(`/api/reports/${report.id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ resolved: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update report.');
        return;
      }
      setIntegrityReports((prev) =>
        prev.map((row) => (row.id === report.id ? { ...row, ...data.report } : row))
      );
      showAdminToast(`Report about "${report.businessName}" marked resolved.`);
    } catch {
      alert('Cannot reach server. Make sure the backend is running.');
    }
  };

  const filteredIntegrityReports = useMemo(() => {
    if (reportFilter === 'all') return integrityReports;
    return integrityReports.filter((report) => report.status === reportFilter);
  }, [integrityReports, reportFilter]);

  const handleDeleteListing = async (biz: Business) => {
    if (!confirm(`Remove ${biz.name} completely from directories?`)) return;
    if (!apiToken) {
      alert('Admin session expired. Please sign in again.');
      return;
    }
    setActionBusyId(biz.id);
    try {
      const res = await apiFetch(`/api/directory/${biz.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete listing on server.');
        return;
      }
      removeBusiness(biz.id);
      await loadVettingData();
      await loadDuesLedger();
      showAdminToast(`${biz.name} removed from the directory.`);
    } catch {
      alert('Cannot reach server. Make sure the backend is running.');
    } finally {
      setActionBusyId(null);
    }
  };

  const activePaidListings = useMemo(
    () => getActivePaidListings(businesses),
    [businesses],
  );

  const platformRevenue = useMemo(
    () => calculateRevenueFromPayments(payments),
    [payments],
  );

  const loadDuesLedger = async () => {
    if (!apiToken) return;
    setDuesLoading(true);
    setDuesError('');
    try {
      const res = await apiFetch('/api/payments/ledger', {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setDuesError(data.error || 'Failed to load dues ledger.');
        setDuesLedger([]);
        return;
      }
      setDuesLedger(Array.isArray(data.rows) ? data.rows : []);
      setDuesStats({
        totalRevenue: Number(data.totalRevenue) || 0,
        transactionCount: Number(data.transactionCount) || 0,
        activeListings: Number(data.activeListings) || activePaidListings.length,
      });
      await refreshPayments(apiToken, 'admin');
    } catch {
      setDuesError('Cannot reach server. Make sure the backend is running.');
      setDuesLedger([]);
    } finally {
      setDuesLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || adminTab !== 'pay') return;
    loadDuesLedger();
  }, [isAdmin, adminTab, apiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadVettingData = async () => {
    if (!isAdmin) return;
    setVettingLoading(true);
    try {
      await Promise.all([
        refreshDirectory(currentUser),
        refreshPayments(apiToken, 'admin'),
      ]);
    } finally {
      setVettingLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || adminTab !== 'biz') return;
    loadVettingData();
  }, [isAdmin, adminTab, apiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const paymentsForListing = (businessId: string) =>
    payments.filter((p) => p.businessId === businessId);

  const vettingCounts = useMemo(() => {
    const today = new Date();
    return businesses.reduce(
      (acc, biz) => {
        const listingPayments = paymentsForListing(biz.id);
        const expiry = new Date(biz.membershipExpiryDate);
        const isExpiredDate = !Number.isNaN(expiry.getTime()) && expiry < today;

        if (isPendingSubmission(biz)) acc.submissions += 1;
        if (biz.status === 'active' && biz.isVerified) acc.active += 1;
        if (listingNeedsPayment(biz, listingPayments)) acc.pending += 1;
        if ((biz.status === 'suspended' || isExpiredDate) && biz.isVerified) acc.expired += 1;
        return acc;
      },
      { all: businesses.length, submissions: 0, active: 0, pending: 0, expired: 0 },
    );
  }, [businesses, payments]);

  const filteredDirectoryUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return directoryUsers;
    return directoryUsers.filter(
      (user) =>
        user.email.toLowerCase().includes(q) ||
        user.name.toLowerCase().includes(q) ||
        user.roleLabel.toLowerCase().includes(q) ||
        (user.listingName || '').toLowerCase().includes(q)
    );
  }, [directoryUsers, userSearch]);

  const openReportCount = useMemo(
    () => integrityReports.filter((r) => r.status === 'open').length,
    [integrityReports],
  );

  const showAdminToast = (message: string) => {
    setAdminToast(message);
    setTimeout(() => setAdminToast(''), 3500);
  };

  const jobCounts = useMemo(() => ({
    all: adminJobs.length,
    active: adminJobs.filter((j) => j.isActive).length,
    blocked: adminJobs.filter((j) => !j.isActive).length,
  }), [adminJobs]);

  const filteredAdminJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    return adminJobs.filter((job) => {
      if (jobFilter === 'active' && !job.isActive) return false;
      if (jobFilter === 'blocked' && job.isActive) return false;
      if (!q) return true;
      return (
        job.title.toLowerCase().includes(q) ||
        job.businessName.toLowerCase().includes(q) ||
        job.category.toLowerCase().includes(q) ||
        job.hiringEmail.toLowerCase().includes(q)
      );
    });
  }, [adminJobs, jobSearch, jobFilter]);

  const handleToggleJobBlock = async (job: Job) => {
    if (!apiToken) {
      alert('Admin session expired. Please sign in again.');
      return;
    }
    const nextActive = !job.isActive;
    const actionLabel = nextActive ? 'unblock' : 'block';
    if (!confirm(`${nextActive ? 'Unblock' : 'Block'} "${job.title}" at ${job.businessName}?`)) return;

    setActionBusyId(job.id);
    try {
      const res = await apiFetch(`/api/jobsboard/${job.id}/active`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || `Could not ${actionLabel} job on server.`);
        return;
      }
      setAdminJobs((prev) =>
        prev.map((row) =>
          row.id === job.id ? { ...row, isActive: Boolean(data.isActive) } : row,
        ),
      );
      await refreshJobs(apiToken);
      showAdminToast(
        nextActive
          ? `"${job.title}" is live on the job board again.`
          : `"${job.title}" blocked — hidden from the public job board.`,
      );
    } catch {
      alert('Cannot reach server. Make sure the backend is running.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteJob = async (job: Job) => {
    if (!apiToken) return;
    if (!confirm(`Permanently delete "${job.title}" at ${job.businessName}?`)) return;
    setActionBusyId(job.id);
    try {
      const res = await apiFetch(`/api/jobsboard/${job.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete job.');
        return;
      }
      setAdminJobs((prev) => prev.filter((row) => row.id !== job.id));
      await refreshJobs(apiToken);
      showAdminToast(`"${job.title}" deleted.`);
    } catch {
      alert('Cannot reach server. Make sure the backend is running.');
    } finally {
      setActionBusyId(null);
    }
  };

  const patchListing = async (
    biz: Business,
    body: Record<string, unknown>,
    localPatch: Partial<Business>,
  ): Promise<boolean> => {
    if (!apiToken) {
      alert('Admin session expired. Please sign in again.');
      return false;
    }
    setActionBusyId(biz.id);
    updateBusiness({ ...biz, ...localPatch });
    try {
      const res = await apiFetch(`/api/directory/${biz.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Could not update listing on server.');
        await loadVettingData();
        return false;
      }
      await loadVettingData();
      void refreshNotifications(apiToken);
      return true;
    } catch {
      alert('Cannot reach server. Make sure the backend is running.');
      await loadVettingData();
      return false;
    } finally {
      setActionBusyId(null);
    }
  };

  const filteredVettingListings = useMemo(() => {
    const today = new Date();
    const filtered = businesses.filter((biz) => {
      const searchLower = vendorSearch.toLowerCase();
      if (
        vendorSearch &&
        !biz.name.toLowerCase().includes(searchLower) &&
        !biz.city.toLowerCase().includes(searchLower) &&
        !biz.ownerId.toLowerCase().includes(searchLower) &&
        !biz.phone.toLowerCase().includes(searchLower) &&
        !biz.subcategory.en.toLowerCase().includes(searchLower)
      ) {
        return false;
      }

      const listingPayments = payments.filter((p) => p.businessId === biz.id);
      const expiry = new Date(biz.membershipExpiryDate);
      const isExpiredDate = !Number.isNaN(expiry.getTime()) && expiry < today;

      if (bizFilter === 'all') return true;
      if (bizFilter === 'submissions') return isPendingSubmission(biz);
      if (bizFilter === 'active') return biz.status === 'active' && biz.isVerified;
      if (bizFilter === 'pending') return listingNeedsPayment(biz, listingPayments);
      if (bizFilter === 'expired') return (biz.status === 'suspended' || isExpiredDate) && biz.isVerified;
      return true;
    });

    return filtered.sort((a, b) => {
      const aPending = isPendingSubmission(a) ? 0 : 1;
      const bPending = isPendingSubmission(b) ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return a.name.localeCompare(b.name);
    });
  }, [businesses, vendorSearch, bizFilter, payments]);

  if (isNativeApp()) {
    return (
      <div className="p-8 text-center rounded-3xl bg-[#13110E] border border-[#2D2319] text-gray-400" id="admin-web-only-state">
        <ShieldAlert className="w-12 h-12 text-[#FFA048] mx-auto mb-3" />
        <h3 className="text-sm font-black text-[#FFA048] uppercase tracking-widest">{t.adminPanel}</h3>
        <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
          The admin panel is available only on the web app. Approvals and changes you make there appear automatically in the Android and iOS apps.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center rounded-3xl bg-[#13110E] border border-red-950/40 text-gray-400" id="admin-forbidden-state">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">{t.adminPanel} Restricted</h3>
        <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Administrative controls, business vetting approvals, and category management are restricted to platform administrators only.
        </p>
        <p className="text-[10px] text-gray-600 font-mono mt-4">
          👉 Sign in with an admin account (e.g. admin@shiadirectory.com) to access this panel.
        </p>
      </div>
    );
  }

  // Vetting triggers
  const handleApproveVetting = async (biz: Business) => {
    const ok = await patchListing(
      biz,
      { isVerified: true, subscriptionStatus: 'active' },
      { isVerified: true, status: 'active' },
    );
    if (ok) showAdminToast(`${biz.name} approved and is now live in the directory.`);
  };

  const handleToggleStatus = async (biz: Business) => {
    const nextStatus = biz.status === 'active' ? 'suspended' : 'active';
    const ok = await patchListing(
      biz,
      { subscriptionStatus: nextStatus },
      { status: nextStatus },
    );
    if (ok) showAdminToast(`${biz.name} is now ${nextStatus.toUpperCase()}.`);
  };

  const handleMarkAsPaid = async (biz: Business) => {
    if (!apiToken) return;
    setActionBusyId(biz.id);
    const amount = getListingMonthlyFee(biz);
    try {
      const result = await renewMembership(biz.id, amount);
      if (!result.success) {
        alert(result.error || 'Could not record payment.');
        return;
      }
      await loadVettingData();
      await loadDuesLedger();
      showAdminToast(`${biz.name} paid — $${amount} recorded (ref ${result.payment?.refNo ?? '—'}).`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (biz: Business) => {
    const ok = await patchListing(
      biz,
      { subscriptionStatus: 'suspended', isVerified: false },
      { status: 'suspended', isVerified: false },
    );
    if (ok) showAdminToast(`${biz.name} submission rejected.`);
  };

  // Category addition trigger
  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameEn.trim()) return;

    setCatError('');
    setCatSuccess('');
    setCatSubmitting(true);

    const slug = newCatNameEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
    const label = newCatNameEn.trim();
    const newCat: Category = {
      id: `cat-${slug}-${Date.now()}`,
      name: { en: label, ar: label },
      group: newCatGroup,
      iconName: newCatGroup === 'Food' ? 'Soup' : newCatGroup === 'Professionals' ? 'UserCheck' : 'Wrench',
    };

    const result = await addCategory(newCat);
    setCatSubmitting(false);

    if (!result.success) {
      setCatError(result.error || 'Failed to create category.');
      return;
    }

    await refreshCategories();
    setNewCatNameEn('');
    setCatSuccess('Category created!');
    setTimeout(() => setCatSuccess(''), 3000);
  };

  const toggleBlockUser = async (user: AdminUserRow) => {
    if (!apiToken) return;
    const nextBlocked = !user.isBlocked;
    if (nextBlocked && !confirm(`Block ${user.email}? They will not be able to sign in.`)) return;

    try {
      const res = await apiFetch(`/api/auth/users/${user.id}/block`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ blocked: nextBlocked }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update user.');
        return;
      }
      setDirectoryUsers((prev) =>
        prev.map((row) =>
          row.id === user.id ? { ...row, isBlocked: Boolean(data.user?.isBlocked) } : row
        )
      );
      showAdminToast(nextBlocked ? `${user.email} blocked.` : `${user.email} unblocked.`);
    } catch {
      alert('Cannot reach server. Make sure the backend is running.');
    }
  };

  return (
    <div className="space-y-6" id="admin-panel-container">
      
      {/* Title */}
      <div className="pb-1.5 border-b border-[#2D2319] flex justify-between items-center" id="admin-main-header">
        <div>
          <h2 className="text-xl font-extrabold text-[#F4E3D7] flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#FFA048]" />
            {t.adminTitle}
          </h2>
          <p className="text-[10px] text-gray-500 font-medium">Platform-wide control, dues audit, and directory indexing</p>
        </div>
      </div>

      {adminToast && (
        <div className="px-4 py-2.5 rounded-xl bg-green-950/40 border border-green-800/50 text-green-300 text-xs font-semibold flex items-center gap-2 animate-scale-up">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {adminToast}
        </div>
      )}

      {/* Internal Navigation tabs */}
      <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[#13110E] border border-[#2D2319]" id="admin-segment-bar">
        <button
          onClick={() => setAdminTab('biz')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'biz' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-[#F4E3D7]'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Vetting</span>
          {vettingCounts.submissions > 0 && adminTab !== 'biz' && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-black text-[8px] font-black leading-4">
              {vettingCounts.submissions}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('pay')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'pay' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-[#F4E3D7]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Dues</span>
        </button>

        <button
          onClick={() => setAdminTab('jobs')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'jobs' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-[#F4E3D7]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Jobs</span>
          {jobCounts.blocked > 0 && adminTab !== 'jobs' && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-black text-[8px] font-black leading-4">
              {jobCounts.blocked}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('cat')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'cat' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-[#F4E3D7]'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Categories</span>
        </button>

        <button
          onClick={() => setAdminTab('users')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'users' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-[#F4E3D7]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users</span>
          {openReportCount > 0 && adminTab !== 'users' && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[8px] font-black leading-4">
              {openReportCount}
            </span>
          )}
        </button>
      </div>

      {/* SEGMENT 1: BUSINESS VETTING APPROVALS & SUSPENSIONS (Section 8) */}
      {adminTab === 'biz' && (
        <div className="space-y-4 animate-scale-up" id="admin-biz-section">
          
          {/* Financial Controls Analytics */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#1C1914] border border-[#2D2319] p-4 rounded-2xl relative overflow-hidden">
              <DollarSign className="w-10 h-10 text-[#FFA048] absolute right-3 top-3 opacity-10" />
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Collected Revenue</p>
              <h3 className="text-xl font-black text-white">{formatUsd(platformRevenue)}</h3>
            </div>
            <div className="bg-[#1C1914] border border-[#2D2319] p-4 rounded-2xl relative overflow-hidden">
              <Award className="w-10 h-10 text-green-500 absolute right-3 top-3 opacity-10" />
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Active Listings</p>
              <h3 className="text-xl font-black text-green-400">{activePaidListings.length}</h3>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#FFA048]">
              Directory Index approvals & Status Locking
            </h3>
            <button
              type="button"
              onClick={loadVettingData}
              className="text-[9px] font-bold text-[#FFA048] hover:underline shrink-0"
            >
              {vettingLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          
          <div className="flex items-center bg-[#13110E] border border-[#2D2319] rounded-xl px-4 py-3 mb-2">
            <Search className="w-4 h-4 text-gray-500 mr-3" />
            <input 
              type="text" 
              placeholder="Search vendors by name, email, or city..." 
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              className="bg-transparent border-none text-[#F4E3D7] text-sm outline-none w-full placeholder:text-gray-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All Listings', vettingCounts.all],
              ['submissions', 'Awaiting Approval', vettingCounts.submissions],
              ['active', 'Registered / Active', vettingCounts.active],
              ['pending', 'Payment Due', vettingCounts.pending],
              ['expired', 'Payment Expired', vettingCounts.expired],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setBizFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                  bizFilter === key
                    ? key === 'all'
                      ? 'bg-[#2D2319] text-[#F4E3D7] border border-[#3A2E22]'
                      : key === 'submissions'
                      ? 'bg-[#FFA048] text-black shadow-lg shadow-[#FFA048]/20'
                      : key === 'active'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : key === 'pending'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                          : 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'
                }`}
              >
                {label}
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${
                  bizFilter === key ? 'bg-black/20' : 'bg-[#2D2319] text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {vettingCounts.submissions > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FFA048]/10 border border-[#FFA048]/30 text-[10px] text-[#FFA048]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                {language === 'en'
                  ? `${vettingCounts.submissions} listing(s) need your review. Approve or Decline them below, or open the Awaiting Approval filter.`
                  : `${vettingCounts.submissions} قائمة/قوائم تحتاج مراجعتك. وافق أو ارفض من الأسفل، أو افتح فلتر "بانتظار الموافقة".`}
              </p>
            </div>
          )}

          <div className="space-y-3" id="admin-vetting-list">
            {vettingLoading && (
              <p className="text-[10px] text-gray-500 py-4 text-center">Loading listings from server…</p>
            )}

            {!vettingLoading && filteredVettingListings.length === 0 && (
              <div className="p-6 rounded-2xl bg-[#13110E] border border-dashed border-[#2D2319] text-center text-gray-500 text-xs space-y-2">
                {bizFilter === 'submissions' ? (
                  <>
                    <p>
                      {language === 'en'
                        ? 'No new business submissions awaiting approval.'
                        : 'لا توجد طلبات تسجيل جديدة بانتظار الموافقة.'}
                    </p>
                    {vettingCounts.active > 0 && (
                      <p className="text-[10px] text-[#FFA048]">
                        {language === 'en'
                          ? `${vettingCounts.active} listing(s) already approved — open All Listings or Registered / Active to manage them.`
                          : `${vettingCounts.active} نشاط/أنشطة موافق عليها — افتح "كل القوائم" أو "مسجل / نشط" لإدارتها.`}
                      </p>
                    )}
                  </>
                ) : bizFilter === 'all' ? (
                  <p>{language === 'en' ? 'No business listings in the directory yet.' : 'لا توجد قوائم أعمال في الدليل بعد.'}</p>
                ) : (
                  <p>{language === 'en' ? 'No listings match this filter.' : 'لا توجد نتائج لهذا الفلتر.'}</p>
                )}
              </div>
            )}
            {filteredVettingListings.map((biz) => {
              const isSuspended = biz.status === 'suspended';
              const bizPayments = paymentsForListing(biz.id);
              const onTrial = isListingOnFreeTrial(biz, bizPayments);
              const isBusy = actionBusyId === biz.id;
              const awaitingApproval = isPendingSubmission(biz);
              const descPreview = (biz.description?.en || '').trim();
              return (
                <div key={biz.id} className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3.5">
                  <AdminListingPhotos business={biz} language={language} />

                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-black text-white truncate">{biz.name}</h4>
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase bg-[#2D2319] text-gray-400">
                            {biz.listingType === 'service' ? 'Service' : 'Business'}
                          </span>
                        </div>
                        <span className="text-[9px] text-gray-500 block uppercase tracking-wider mt-0.5">
                          {biz.city} • {biz.subcategory.en}
                        </span>
                        <span className="text-[8px] text-gray-600 block truncate">{biz.ownerId}</span>
                        {biz.phone && (
                          <span className="text-[8px] text-gray-500 block">{biz.phone}</span>
                        )}
                        {biz.address && (
                          <span className="text-[8px] text-gray-600 block truncate">{biz.address}{biz.area ? `, ${biz.area}` : ''}</span>
                        )}
                        {descPreview && (
                          <p className="text-[9px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{descPreview}</p>
                        )}
                        {biz.registeredAt && (
                          <span className="text-[7px] text-gray-600 block mt-1">Registered: {biz.registeredAt}</span>
                        )}
                    </div>

                    <div className="text-right space-y-1 shrink-0">
                      {awaitingApproval && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest uppercase block bg-[#FFA048]/15 text-[#FFA048]">
                          AWAITING APPROVAL
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest uppercase block ${
                        biz.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        biz.status === 'pending' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {biz.status.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold block ${
                        biz.isVerified ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {biz.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
                      </span>
                      {onTrial && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-green-500/15 text-green-400 block">
                          FREE TRIAL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions area */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#2D2319]/45 justify-between items-center text-xs" id={`vet-actions-${biz.id}`}>
                    <div className="flex gap-2 w-full justify-between flex-wrap">
                      {awaitingApproval && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveVetting(biz)}
                            disabled={isBusy}
                            className="px-3 py-1 rounded bg-green-600/15 text-green-300 hover:bg-green-600/25 border border-green-900/60 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> {isBusy ? 'Saving…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(biz)}
                            disabled={isBusy}
                            className="px-3 py-1 rounded bg-red-600/15 text-red-300 hover:bg-red-600/25 border border-red-900/60 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" /> Decline
                          </button>
                        </div>
                      )}
                      
                      {bizFilter === 'pending' && !awaitingApproval && (
                        <button
                          onClick={() => handleMarkAsPaid(biz)}
                          disabled={isBusy}
                          className="px-3 py-1 rounded bg-[#FFA048]/20 text-[#FFA048] hover:bg-[#FFA048]/30 border border-[#FFA048]/50 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                        >
                          <DollarSign className="w-3 h-3" /> {isBusy ? 'Recording…' : 'Mark as Paid'}
                        </button>
                      )}

                      {(bizFilter === 'active' || bizFilter === 'expired' || (bizFilter === 'all' && biz.isVerified && !awaitingApproval)) && (
                        <button
                          onClick={() => handleToggleStatus(biz)}
                          disabled={isBusy}
                          className={`px-3 py-1 rounded text-[10px] font-bold disabled:opacity-50 ${
                            isSuspended
                              ? 'bg-amber-600 text-black hover:bg-amber-500'
                              : 'bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-950/80'
                          }`}
                        >
                          {isBusy ? 'Updating…' : isSuspended ? '🔓 Re-Activate Listing' : '🔒 Suspend Listing'}
                        </button>
                      )}

                      {/* Hard delete */}
                      <button
                        onClick={() => handleDeleteListing(biz)}
                        disabled={isBusy}
                        className="p-1 px-2 rounded bg-stone-900 hover:bg-stone-850 text-gray-400 hover:text-red-400 disabled:opacity-50"
                        title="Delete listing"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEGMENT 2: SUBSCRIPTION DUES & PAYMENT TRACKING */}
      {adminTab === 'pay' && (
        <div className="space-y-4 animate-scale-up" id="admin-pay-section">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#FFA048]">
              {t.payments} — Membership Fees Register (2-month free trial, then $30–$50/mo)
            </h3>
            <button
              type="button"
              onClick={loadDuesLedger}
              className="text-[9px] font-bold text-[#FFA048] hover:underline shrink-0"
            >
              Refresh
            </button>
          </div>

          {duesError && (
            <p className="text-xs text-red-400">{duesError}</p>
          )}

          {/* Revenue Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: language === 'en' ? 'Total Revenue' : 'إجمالي الإيرادات',
                value: formatUsd(duesStats.totalRevenue),
                color: 'text-green-400',
                hint: language === 'en' ? 'Collected payments only' : 'المدفوعات المحصلة فقط',
              },
              {
                label: language === 'en' ? 'Total Transactions' : 'عدد المعاملات',
                value: duesStats.transactionCount,
                color: 'text-[#FFA048]',
                hint: language === 'en' ? 'Paid renewals' : 'تجديدات مدفوعة',
              },
              {
                label: language === 'en' ? 'Active Listings' : 'نشاطات نشطة',
                value: duesStats.activeListings,
                color: 'text-blue-400',
                hint: language === 'en' ? 'Including free trial' : 'يشمل التجربة المجانية',
              }
            ].map(({ label, value, color, hint }) => (
              <div key={label} className="p-3.5 rounded-2xl bg-[#13110E] border border-[#2D2319] text-center">
                <span className={`text-xl font-black block ${color}`}>{value}</span>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mt-0.5">{label}</span>
                <span className="text-[8px] text-gray-600 block mt-0.5">{hint}</span>
              </div>
            ))}
          </div>

          {/* Payment Records Table */}
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3">
            {duesLoading && (
              <p className="text-[10px] text-gray-500 py-4 text-center">Loading dues ledger…</p>
            )}

            {!duesLoading && duesLedger.length === 0 && !duesError && (
              <p className="text-[10px] text-gray-500 py-4 text-center">
                No listings yet. Revenue stays $0 during the 2-month free trial until owners pay.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse" id="admin-payments-table">
                <thead>
                  <tr className="border-b border-[#2D2319] text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-2 pr-2">{language === 'en' ? 'Business' : 'النشاط التجاري'}</th>
                    <th className="py-2 pr-2">{t.amount}</th>
                    <th className="py-2 pr-2">{t.date}</th>
                    <th className="py-2 pr-2">{language === 'en' ? 'Expires' : 'انتهاء الاشتراك'}</th>
                    <th className="py-2">{t.refNo}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D2319]/45 text-gray-300">
                  {duesLedger.map((row) => {
                    const today = new Date();
                    const expiry = row.expires && row.expires !== '—' ? new Date(row.expires) : null;
                    const isExpired = expiry && expiry < today;
                    const isSoon = expiry && !isExpired && (expiry.getTime() - today.getTime()) < 7 * 24 * 60 * 60 * 1000;
                    const biz = businesses.find((b) => b.id === row.businessId);
                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${isExpired ? 'bg-red-950/15' : isSoon ? 'bg-amber-950/15' : row.status === 'trial' ? 'bg-green-950/10' : ''}`}
                      >
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-1.5">
                            {biz && <BusinessThumbnail business={biz} eager className="w-6 h-6 rounded object-cover" />}
                            <div>
                              <span className="font-semibold text-white text-[10px] block">{row.businessName}</span>
                              {row.status === 'trial' && (
                                <span className="text-[8px] text-green-400 font-bold">FREE TRIAL</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-2 font-mono font-bold text-[#FFA048]">
                          {row.amount === 0 ? '$0' : `$${row.amount}`}
                        </td>
                        <td className="py-3 pr-2 text-gray-400">{row.date}</td>
                        <td className="py-3 pr-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isExpired ? 'bg-red-500/20 text-red-400' :
                            isSoon ? 'bg-amber-500/20 text-amber-400' :
                            'bg-green-500/10 text-green-400'
                          }`}>
                            {row.expires}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-gray-500 text-[10px]">{row.refNo}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subscription status overview */}
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[#FFA048] mb-3">
              {language === 'en' ? 'All Business Subscription Status' : 'حالة اشتراك جميع النشاطات'}
            </h4>
            {businesses.map((biz) => {
              const today = new Date();
              const ledgerRow = duesLedger.find((row) => row.businessId === biz.id);
              const expiryStr = ledgerRow?.expires && ledgerRow.expires !== '—'
                ? ledgerRow.expires
                : biz.membershipExpiryDate;
              const expiry = new Date(expiryStr);
              const daysLeft = Number.isNaN(expiry.getTime())
                ? 0
                : Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const onTrial = ledgerRow?.status === 'trial';
              return (
                <div key={biz.id} className="flex items-center justify-between py-2 border-b border-[#2D2319]/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${biz.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-semibold text-white">{biz.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="text-gray-500">{expiryStr}</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                      biz.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                      onTrial ? 'bg-green-500/20 text-green-400' :
                      daysLeft <= 7 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-green-500/10 text-green-400'
                    }`}>
                      {biz.status === 'suspended'
                        ? (language === 'en' ? 'Suspended' : 'معلق')
                        : onTrial
                          ? (language === 'en' ? 'Free trial' : 'تجربة مجانية')
                        : daysLeft <= 0
                          ? (language === 'en' ? 'Expired' : 'منتهي')
                          : `${daysLeft}d left`
                      }
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEGMENT: JOB POSTINGS MODERATION */}
      {adminTab === 'jobs' && (
        <div className="space-y-4 animate-scale-up" id="admin-jobs-section">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#FFA048]">
              Job Board — Business Postings
            </h3>
            <button
              type="button"
              onClick={loadAdminJobs}
              className="text-[9px] font-bold text-[#FFA048] hover:underline shrink-0"
            >
              {jobsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              ['all', language === 'en' ? 'Total Jobs' : 'إجمالي الوظائف', jobCounts.all, 'text-[#FFA048]'],
              ['active', language === 'en' ? 'Active' : 'نشطة', jobCounts.active, 'text-green-400'],
              ['blocked', language === 'en' ? 'Blocked' : 'محظورة', jobCounts.blocked, 'text-red-400'],
            ] as const).map(([key, label, count, color]) => (
              <button
                key={key}
                type="button"
                onClick={() => setJobFilter(key)}
                className={`p-3.5 rounded-2xl border text-center transition-all ${
                  jobFilter === key
                    ? 'bg-[#FFA048]/10 border-[#FFA048]/40'
                    : 'bg-[#13110E] border-[#2D2319]'
                }`}
              >
                <span className={`text-xl font-black block ${color}`}>{count}</span>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#13110E] border border-[#2D2319] rounded-xl px-4 py-3">
            <Search className="w-4 h-4 text-gray-500 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search by job title, business, category, or email…"
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              className="bg-transparent border-none text-[#F4E3D7] text-sm outline-none w-full placeholder:text-gray-500"
            />
          </div>

          {jobsError && <p className="text-xs text-red-400">{jobsError}</p>}

          <div className="space-y-3" id="admin-jobs-list">
            {jobsLoading && (
              <p className="text-[10px] text-gray-500 py-4 text-center">Loading job postings…</p>
            )}

            {!jobsLoading && filteredAdminJobs.length === 0 && (
              <div className="p-6 rounded-2xl bg-[#13110E] border border-dashed border-[#2D2319] text-center text-gray-500 text-xs">
                {language === 'en'
                  ? 'No job postings match this filter.'
                  : 'لا توجد وظائف مطابقة لهذا الفلتر.'}
              </div>
            )}

            {filteredAdminJobs.map((job) => {
              const isBusy = actionBusyId === job.id;
              const biz = businesses.find((b) => b.id === job.businessId);
              return (
                <div
                  key={job.id}
                  className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex gap-3 min-w-0 flex-1">
                      <BusinessThumbnail
                        business={{
                          id: job.businessId,
                          name: job.businessName,
                          logoUrl: job.businessLogoUrl,
                        }}
                        eager
                        className="w-11 h-11 rounded-lg object-cover bg-[#1C1914] border border-[#2D2319] shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-white truncate">{job.title}</h4>
                        <span className="text-[9px] text-gray-500 block uppercase tracking-wider mt-0.5">
                          {job.businessName}
                        </span>
                        <span className="text-[8px] text-[#FFA048] font-bold block mt-0.5">{job.category}</span>
                        <span className="text-[8px] text-gray-600 block truncate">{job.hiringEmail}</span>
                        {job.requirements && (
                          <p className="text-[9px] text-gray-500 mt-1.5 line-clamp-2">{job.requirements}</p>
                        )}
                        <span className="text-[8px] text-gray-600 block mt-1">
                          ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                          {job.postedDate ? ` • Posted ${job.postedDate}` : ''}
                        </span>
                        {biz && (
                          <span className="text-[7px] text-gray-600 block">
                            Listing: {biz.city} • {biz.subcategory.en}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                        job.isActive
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {job.isActive ? 'Active' : 'Blocked'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#2D2319]/45">
                    <button
                      type="button"
                      onClick={() => handleToggleJobBlock(job)}
                      disabled={isBusy}
                      className={`px-3 py-1 rounded text-[10px] font-bold disabled:opacity-50 ${
                        job.isActive
                          ? 'bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-950/70'
                          : 'bg-green-600/15 text-green-300 border border-green-900/60 hover:bg-green-600/25'
                      }`}
                    >
                      {isBusy ? 'Saving…' : job.isActive ? 'Block Job' : 'Unblock Job'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job)}
                      disabled={isBusy}
                      className="p-1 px-2 rounded bg-stone-900 hover:bg-stone-850 text-gray-400 hover:text-red-400 disabled:opacity-50"
                      title="Delete job"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEGMENT 3: DYNAMIC CATEGORY CREATOR */}
      {adminTab === 'cat' && (
        <div className="space-y-4 animate-scale-up" id="admin-cat-section">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#FFA048]">
            Create Categories & Subcategories
          </h3>

          {/* Creation Form */}
          <form onSubmit={handleAddCategorySubmit} className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3.5" id="admin-cat-form">
            {catSuccess && <p className="text-xs text-green-400 mb-1">{catSuccess}</p>}
            {catError && <p className="text-xs text-red-400 mb-1">{catError}</p>}
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Category Title</label>
              <input
                type="text"
                placeholder="e.g. Construction"
                value={newCatNameEn}
                onChange={(e) => setNewCatNameEn(e.target.value)}
                className="w-full p-2 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] app-label mb-1">Grouping classification</label>
              <select
                value={newCatGroup}
                onChange={(e: any) => setNewCatGroup(e.target.value)}
                className="w-full p-2 rounded-xl border text-xs app-field"
              >
                <option value="Shops">Shops</option>
                <option value="Services">Services</option>
                <option value="Professionals">Professionals</option>
                <option value="Food">Food</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={catSubmitting}
              className="w-full py-2 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold text-xs rounded-xl disabled:opacity-60"
              id="btn-admin-add-cat-submit"
            >
              {catSubmitting ? 'Saving…' : '+ Create Category Record'}
            </button>
          </form>

          {/* Existing Categories list */}
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319]" id="admin-cats-list">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-gray-500 uppercase font-black">
                Currently Configured Directory Tags ({categories.length})
              </span>
              <button
                type="button"
                onClick={() => refreshCategories()}
                className="text-[9px] font-bold text-[#FFA048] hover:underline"
              >
                Refresh
              </button>
            </div>

            {catsLoading && (
              <p className="text-[10px] text-gray-500 py-4 text-center">Loading categories…</p>
            )}

            {!catsLoading && categories.length === 0 && (
              <p className="text-[10px] text-gray-500 py-4 text-center">
                No categories yet. Create one above — they appear on Home, Search, and registration forms.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto scrollbar-thin" id="admin-cats-grid">
              {categories.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319]/40 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{c.name.en}</span>
                    <span className="text-[8px] text-[#FFA048] font-bold block">{c.group}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Remove category "${c.name.en}"?`)) return;
                      setCatError('');
                      const result = await removeCategory(c.id);
                      if (!result.success) {
                        setCatError(result.error || 'Failed to delete category.');
                        return;
                      }
                      await refreshCategories();
                    }}
                    className="p-1 shrink-0 text-gray-600 hover:text-red-400 rounded"
                    title="Remove category"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 4: USER MANAGEMENT & ABUSE REPORTS */}
      {adminTab === 'users' && (
        <div className="space-y-4 animate-scale-up" id="admin-users-section">
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#FFA500] flex items-center gap-1">
                <Users className="w-4 h-4" /> Active Directory Members
                {!usersLoading && (
                  <span className="text-[9px] text-gray-500 font-bold normal-case">({directoryUsers.length})</span>
                )}
              </h4>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-[10px] rounded-lg bg-[#0F0E0C] border border-[#2D2319] text-gray-300 placeholder:text-gray-600"
                />
              </div>
            </div>

            {usersLoading && (
              <p className="text-[10px] text-gray-500 py-4 text-center">Loading users...</p>
            )}

            {usersError && !usersLoading && (
              <div className="py-3 space-y-2">
                <p className="text-[10px] text-red-400">{usersError}</p>
                <button
                  onClick={loadDirectoryUsers}
                  className="text-[9px] font-bold text-[#FFA048] hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!usersLoading && !usersError && filteredDirectoryUsers.length === 0 && (
              <p className="text-[10px] text-gray-500 py-4 text-center">
                {userSearch ? 'No users match your search.' : 'No registered users yet.'}
              </p>
            )}

            <div className="divide-y divide-[#2D2319]/45 text-xs text-gray-300">
              {filteredDirectoryUsers.map((user) => (
                <div key={user.id} className="py-2.5 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <span className="block font-bold truncate">{user.email}</span>
                    <span className="text-[9px] text-gray-550 block truncate">
                      {user.name} • {user.listingStatus}
                    </span>
                  </div>
                  {user.role === 'admin' ? (
                    <span className="shrink-0 px-2.5 py-1 text-[9px] font-bold rounded bg-[#FFA048]/15 text-[#FFA048]">
                      Admin
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleBlockUser(user)}
                      className={`shrink-0 px-2.5 py-1 text-[9px] font-bold rounded ${
                        user.isBlocked
                          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-800/40'
                          : 'bg-stone-900 text-red-400 hover:bg-stone-850'
                      }`}
                    >
                      {user.isBlocked ? 'Unblock' : 'Block User'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Abuse reporting index */}
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#FFA500] flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Community Integrity & Feedback Reports
                {!reportsLoading && (
                  <span className="text-[9px] text-gray-500 font-bold normal-case">({integrityReports.length})</span>
                )}
              </h4>
              <div className="flex gap-1">
                {(['open', 'resolved', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setReportFilter(filter)}
                    className={`px-2 py-1 text-[9px] font-bold rounded uppercase ${
                      reportFilter === filter
                        ? 'bg-[#FFA048] text-black'
                        : 'bg-stone-900 text-gray-400 hover:text-[#F4E3D7]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {reportsLoading && (
              <p className="text-[10px] text-gray-500 py-4 text-center">Loading reports...</p>
            )}

            {reportsError && !reportsLoading && (
              <div className="py-3 space-y-2">
                <p className="text-[10px] text-red-400">{reportsError}</p>
                <button
                  onClick={loadIntegrityReports}
                  className="text-[9px] font-bold text-[#FFA048] hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!reportsLoading && !reportsError && filteredIntegrityReports.length === 0 && (
              <p className="text-[10px] text-gray-500 py-4 text-center">
                {reportFilter === 'open'
                  ? 'No open reports. Community members can flag listings from a business detail page.'
                  : 'No reports in this filter.'}
              </p>
            )}

            <div className="space-y-2" id="admin-reports-list">
              {filteredIntegrityReports.map((rep) => (
                <div key={rep.id} className="p-3 rounded-xl bg-[#0F0E0C] border border-red-950/20 space-y-1 text-xs">
                  <div className="flex justify-between items-start gap-2 text-[9px] text-gray-500">
                    <span>Date: {rep.date}</span>
                    <span className={`font-bold text-right ${rep.status === 'open' ? 'text-red-400' : 'text-green-400'}`}>
                      {rep.status === 'open' ? 'UNRESOLVED' : 'RESOLVED'}
                    </span>
                  </div>
                  <p>
                    <strong className="text-white">Reporter:</strong> {rep.reporterName}
                    {rep.reporterEmail ? ` (${rep.reporterEmail})` : ''}
                  </p>
                  <p>
                    <strong className="text-white">Flagged Listing:</strong> {rep.businessName}
                  </p>
                  <p className="text-gray-400 text-[11px] leading-relaxed mt-1">
                    <strong className="text-gray-350">Incident details: </strong>
                    &quot;{rep.reason}&quot;
                  </p>
                  {rep.status === 'open' && (
                    <button
                      onClick={() => resolveReport(rep)}
                      className="mt-2 px-2.5 py-1 text-[9px] font-bold rounded bg-green-600/20 text-green-400 hover:bg-green-600/30"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
