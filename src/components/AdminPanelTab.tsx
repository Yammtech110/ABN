import React, { useMemo, useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { apiFetch } from '../lib/api';
import { TRANSLATIONS } from '../data/translations';
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
  X
} from 'lucide-react';
import { Business, Category } from '../types';
import {
  calculatePlatformRevenue,
  formatUsd,
  getActivePaidListings,
} from '../utils/platformStats';
import { isPendingSubmission } from '../utils/listingAccess';

export const AdminPanelTab: React.FC = () => {
  const {
    language,
    currentUser,
    businesses,
    categories,
    payments,
    addCategory,
    removeCategory,
    updateBusiness,
    removeBusiness,
    apiToken,
    refreshDirectory,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  // Selected administrative segment
  const [adminTab, setAdminTab] = useState<'biz' | 'pay' | 'cat' | 'users'>('biz');
  const [bizFilter, setBizFilter] = useState<'active' | 'pending' | 'expired' | 'submissions'>('submissions');
  const [vendorSearch, setVendorSearch] = useState('');

  // Category insertion state
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatNameAr, setNewCatNameAr] = useState('');
  const [newCatGroup, setNewCatGroup] = useState<'Shops' | 'Services' | 'Professionals' | 'Food'>('Shops');
  const [catSuccess, setCatSuccess] = useState('');

  // User management block simulation
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [userReportLogs] = useState([
    { id: 'rep-1', reporter: 'Ali Kazem', target: 'Noor Electricians', reason: 'Unresponsive phone line', date: '2026-06-18' }
  ]);

  // Is current logged in user an admin?
  const isAdmin = currentUser?.role === 'admin';

  const activePaidListings = useMemo(
    () => getActivePaidListings(businesses),
    [businesses],
  );

  const platformRevenue = useMemo(
    () => calculatePlatformRevenue(businesses),
    [businesses],
  );

  if (!isAdmin) {
    return (
      <div className="p-8 text-center rounded-3xl bg-[#13110E] border border-red-950/40 text-gray-400" id="admin-forbidden-state">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">{t.adminPanel} Restricted</h3>
        <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
          {language === 'en'
            ? 'Administrative controls, business vetting approvals, and category creations are restricted to platform administrators only.'
            : 'إن صلاحيات الموافقة وتعديل التصنيفات وتوقيف العضويات محصورة فقط بمسؤولي إدارة التطبيق لحماية المجتمع.'}
        </p>
        <p className="text-[10px] text-gray-600 font-mono mt-4">
          👉 Hint: Switch your profile to "Admin" in the account Quick shortcuts for full access.
        </p>
      </div>
    );
  }

  // Vetting triggers
  const handleApproveVetting = async (biz: Business) => {
    const approved: Business = { ...biz, isVerified: true, status: 'active' };
    updateBusiness(approved);

    if (apiToken) {
      try {
        await apiFetch(`/api/directory/${biz.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ isVerified: true, subscriptionStatus: 'active' }),
        });
        await refreshDirectory();
      } catch {
        console.warn('[ABN Admin] Could not sync listing approval to server.');
      }
    }

    alert(language === 'en' ? `Vetting completed: ${biz.name} is now live in the directory.` : `تم توثيق ${biz.name} بنجاح وأصبح مرئياً في الدليل.`);
  };

  const syncStatusToBackend = async (biz: Business, subscriptionStatus: string) => {
    if (!apiToken) return;
    try {
      await apiFetch(`/api/directory/${biz.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ subscriptionStatus }),
      });
      await refreshDirectory();
    } catch {
      console.warn('[ABN Admin] Could not sync status change to server.');
    }
  };

  const handleToggleStatus = async (biz: Business) => {
    const nextStatus = biz.status === 'active' ? 'suspended' : 'active';
    const updated: Business = { ...biz, status: nextStatus };
    updateBusiness(updated);
    await syncStatusToBackend(biz, nextStatus);
    alert(
      language === 'en'
        ? `Status toggled: ${biz.name} is now ${nextStatus.toUpperCase()}`
        : `تم تحديث حالة النشاط: ${biz.name} الآن ${nextStatus === 'active' ? 'نشط' : 'معلق ومخفي'}`
    );
  };

  const handleMarkAsPaid = async (biz: Business) => {
    const updated: Business = { ...biz, status: 'active' };
    updateBusiness(updated);
    await syncStatusToBackend(biz, 'active');
    alert(`${biz.name} marked as PAID manually.`);
  };

  const handleReject = async (biz: Business) => {
    const updated: Business = { ...biz, status: 'suspended' };
    updateBusiness(updated);
    await syncStatusToBackend(biz, 'suspended');
    alert(`${biz.name} submission rejected.`);
  };

  // Category addition trigger
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameEn || !newCatNameAr) return;

    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: { en: newCatNameEn, ar: newCatNameAr },
      group: newCatGroup,
      iconName: newCatGroup === 'Food' ? 'Soup' : newCatGroup === 'Professionals' ? 'UserCheck' : 'Wrench'
    };

    addCategory(newCat);
    setNewCatNameEn('');
    setNewCatNameAr('');
    setCatSuccess(language === 'en' ? 'Category created!' : 'تم إضافة التصنيف الجديد!');
    setTimeout(() => setCatSuccess(''), 3000);
  };

  // Handle block user toggle
  const toggleBlockUser = (email: string) => {
    setBlockedUsers((prev) =>
      prev.includes(email) ? prev.filter((u) => u !== email) : [...prev, email]
    );
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

      {/* Internal Navigation tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#13110E] border border-[#2D2319]" id="admin-segment-bar">
        <button
          onClick={() => setAdminTab('biz')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'biz' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Vetting</span>
        </button>

        <button
          onClick={() => setAdminTab('pay')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'pay' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Dues</span>
        </button>

        <button
          onClick={() => setAdminTab('cat')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'cat' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Categories</span>
        </button>

        <button
          onClick={() => setAdminTab('users')}
          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 ${
            adminTab === 'users' ? 'bg-[#FFA048] text-black shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users</span>
        </button>
      </div>

      {/* SEGMENT 1: BUSINESS VETTING APPROVALS & SUSPENSIONS (Section 8) */}
      {adminTab === 'biz' && (
        <div className="space-y-4 animate-scale-up" id="admin-biz-section">
          
          {/* Financial Controls Analytics */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#1C1914] border border-[#2D2319] p-4 rounded-2xl relative overflow-hidden">
              <DollarSign className="w-10 h-10 text-[#FFA048] absolute right-3 top-3 opacity-10" />
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Platform Revenue</p>
              <h3 className="text-xl font-black text-white">{formatUsd(platformRevenue)}</h3>
            </div>
            <div className="bg-[#1C1914] border border-[#2D2319] p-4 rounded-2xl relative overflow-hidden">
              <Award className="w-10 h-10 text-green-500 absolute right-3 top-3 opacity-10" />
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Active Subs</p>
              <h3 className="text-xl font-black text-green-400">{activePaidListings.length}</h3>
            </div>
          </div>

          <h3 className="text-xs font-black uppercase tracking-wider text-[#FFA048]">
            Directory Index approvals & Status Locking
          </h3>
          
          <div className="flex items-center bg-[#13110E] border border-[#2D2319] rounded-xl px-4 py-3 mb-2">
            <Search className="w-4 h-4 text-gray-500 mr-3" />
            <input 
              type="text" 
              placeholder="Search vendors by name, email, or city..." 
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              className="bg-transparent border-none text-white text-sm outline-none w-full placeholder:text-gray-600"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBizFilter('submissions')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                bizFilter === 'submissions' ? 'bg-[#FFA048] text-black shadow-lg shadow-[#FFA048]/20' : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'
              }`}
            >
              New Submissions
            </button>
            <button
              onClick={() => setBizFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                bizFilter === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'
              }`}
            >
              Registered / Active
            </button>
            <button
              onClick={() => setBizFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                bizFilter === 'pending' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'
              }`}
            >
              Payment Pending
            </button>
            <button
              onClick={() => setBizFilter('expired')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                bizFilter === 'expired' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'
              }`}
            >
              Payment Expired
            </button>
          </div>

          <div className="space-y-3" id="admin-vetting-list">
            {businesses
              .filter((biz) => {
                const searchLower = vendorSearch.toLowerCase();
                if (vendorSearch && !biz.name.toLowerCase().includes(searchLower) && !biz.city.toLowerCase().includes(searchLower)) {
                  return false;
                }
                
                const today = new Date();
                const expiry = new Date(biz.membershipExpiryDate);
                const isExpiredDate = expiry < today;
                
                if (bizFilter === 'submissions') return isPendingSubmission(biz);
                if (bizFilter === 'active') return biz.status === 'active' && biz.isVerified;
                if (bizFilter === 'pending') return biz.status === 'pending' && biz.isVerified;
                if (bizFilter === 'expired') return (biz.status === 'suspended' || isExpiredDate) && biz.isVerified;
                return true;
              })
              .map((biz) => {
              const isSuspended = biz.status === 'suspended';
              return (
                <div key={biz.id} className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-3">
                      <img src={biz.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-stone-950 border border-[#2D2319]" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-white truncate">{biz.name}</h4>
                        <span className="text-[9px] text-gray-500 block uppercase tracking-wider">
                          {biz.city} • {biz.subcategory.en}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest uppercase ${
                        biz.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        biz.status === 'pending' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {biz.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Actions area */}
                  {/* Actions area */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#2D2319]/45 justify-between items-center text-xs" id={`vet-actions-${biz.id}`}>
                    <div className="flex gap-2 w-full justify-between">
                      {/* Workflow Actions */}
                      {bizFilter === 'submissions' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveVetting(biz)}
                            className="px-3 py-1 rounded bg-green-600/15 text-green-300 hover:bg-green-600/25 border border-green-900/60 font-bold text-[10px] flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(biz)}
                            className="px-3 py-1 rounded bg-red-600/15 text-red-300 hover:bg-red-600/25 border border-red-900/60 font-bold text-[10px] flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      )}
                      
                      {bizFilter === 'pending' && (
                        <button
                          onClick={() => handleMarkAsPaid(biz)}
                          className="px-3 py-1 rounded bg-[#FFA048]/20 text-[#FFA048] hover:bg-[#FFA048]/30 border border-[#FFA048]/50 font-bold text-[10px] flex items-center gap-1"
                        >
                          <DollarSign className="w-3 h-3" /> Mark as Paid
                        </button>
                      )}

                      {(bizFilter === 'active' || bizFilter === 'expired') && (
                        <button
                          onClick={() => handleToggleStatus(biz)}
                          className={`px-3 py-1 rounded text-[10px] font-bold ${
                            isSuspended
                              ? 'bg-amber-600 text-black hover:bg-amber-500'
                              : 'bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-950/80'
                          }`}
                        >
                          {isSuspended ? '🔓 Re-Activate Listing' : '🔒 Suspend Listing'}
                        </button>
                      )}

                      {/* Hard delete */}
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${biz.name} completely from directories?`)) {
                            removeBusiness(biz.id);
                          }
                        }}
                        className="p-1 px-2 rounded bg-stone-900 hover:bg-stone-850 text-gray-400 hover:text-red-400"
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
          <h3 className="text-xs font-black uppercase tracking-wider text-[#FFA048]">
            {t.payments} — Membership Fees Register ($50/month)
          </h3>

          {/* Revenue Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: language === 'en' ? 'Total Revenue' : 'إجمالي الإيرادات',
                value: formatUsd(platformRevenue),
                color: 'text-green-400'
              },
              {
                label: language === 'en' ? 'Total Transactions' : 'عدد المعاملات',
                value: payments.filter((p) => p.status === 'success').length,
                color: 'text-[#FFA048]'
              },
              {
                label: language === 'en' ? 'Active Listings' : 'نشاطات نشطة',
                value: activePaidListings.length,
                color: 'text-blue-400'
              }
            ].map(({ label, value, color }) => (
              <div key={label} className="p-3.5 rounded-2xl bg-[#13110E] border border-[#2D2319] text-center">
                <span className={`text-xl font-black block ${color}`}>{value}</span>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mt-0.5">{label}</span>
              </div>
            ))}
          </div>

          {/* Payment Records Table */}
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3">
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
                  {payments.map((p) => {
                    const biz = businesses.find((b) => b.id === p.businessId);
                    const today = new Date();
                    const expiry = biz ? new Date(biz.membershipExpiryDate) : null;
                    const isExpired = expiry && expiry < today;
                    const isSoon = expiry && !isExpired && (expiry.getTime() - today.getTime()) < 7 * 24 * 60 * 60 * 1000;
                    return (
                      <tr key={p.id} className={`transition-colors ${isExpired ? 'bg-red-950/15' : isSoon ? 'bg-amber-950/15' : ''}`}>
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-1.5">
                            {biz?.logoUrl && <img src={biz.logoUrl} alt="" className="w-6 h-6 rounded object-cover" />}
                            <span className="font-semibold text-white text-[10px]">{biz?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-2 font-mono font-bold text-[#FFA048]">${p.amount}</td>
                        <td className="py-3 pr-2 text-gray-400">{p.date}</td>
                        <td className="py-3 pr-2">
                          {biz && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isExpired ? 'bg-red-500/20 text-red-400' :
                              isSoon ? 'bg-amber-500/20 text-amber-400' :
                              'bg-green-500/10 text-green-400'
                            }`}>
                              {biz.membershipExpiryDate}
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-gray-500 text-[10px]">{p.refNo}</td>
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
              const expiry = new Date(biz.membershipExpiryDate);
              const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={biz.id} className="flex items-center justify-between py-2 border-b border-[#2D2319]/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${biz.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-semibold text-white">{biz.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="text-gray-500">{biz.membershipExpiryDate}</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                      biz.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                      daysLeft <= 7 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-green-500/10 text-green-400'
                    }`}>
                      {biz.status === 'suspended'
                        ? (language === 'en' ? 'Suspended' : 'معلق')
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

      {/* SEGMENT 3: DYNAMIC CATEGORY CREATOR */}
      {adminTab === 'cat' && (
        <div className="space-y-4 animate-scale-up" id="admin-cat-section">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#FFA048]">
            Create Categories & Subcategories
          </h3>

          {/* Creation Form */}
          <form onSubmit={handleAddCategorySubmit} className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3.5" id="admin-cat-form">
            {catSuccess && <p className="text-xs text-green-400 mb-1">{catSuccess}</p>}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Category English Title</label>
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
                <label className="block text-[10px] text-gray-400 mb-1">Category Arabic Title</label>
                <input
                  type="text"
                  placeholder="مثال: البناء والإعمار"
                  value={newCatNameAr}
                  onChange={(e) => setNewCatNameAr(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Grouping classification</label>
              <select
                value={newCatGroup}
                onChange={(e: any) => setNewCatGroup(e.target.value)}
                className="w-full p-2 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#FFA048]"
              >
                <option value="Shops">Shops (محلات)</option>
                <option value="Services">Services (خدمات)</option>
                <option value="Professionals">Professionals (مكاتب تخصصية)</option>
                <option value="Food">Food (مواد غذائية ومطاعم)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold text-xs rounded-xl"
              id="btn-admin-add-cat-submit"
            >
              + Create Category Record
            </button>
          </form>

          {/* Existing Categories list */}
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319]" id="admin-cats-list">
            <span className="text-[10px] text-gray-500 uppercase font-black mb-3 block">Currently Configured Directory Tags</span>
            <div className="grid grid-cols-2 gap-2" id="admin-cats-grid">
              {categories.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319]/40 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-white block">{c.name[language] || c.name.en}</span>
                    <span className="text-[8px] text-[#FFA048] font-bold block">{c.group}</span>
                  </div>
                  <button
                    onClick={() => removeCategory(c.id)}
                    className="p-1 text-gray-600 hover:text-red-400 rounded"
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
            <h4 className="text-xs font-black uppercase tracking-wider text-[#FFA500] flex items-center gap-1">
              <Users className="w-4 h-4" /> Active Directory Members
            </h4>
            <div className="divide-y divide-[#2D2319]/45 text-xs text-gray-300">
              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <span className="block font-bold">manimuhammad000@gmail.com</span>
                  <span className="text-[9px] text-gray-550 block">Customer status • No active business listings</span>
                </div>
                <button
                  onClick={() => toggleBlockUser('manimuhammad000@gmail.com')}
                  className={`px-2.5 py-1 text-[9px] font-bold rounded ${
                    blockedUsers.includes('manimuhammad000@gmail.com')
                      ? 'bg-red-600 text-black'
                      : 'bg-stone-900 text-red-400 hover:bg-stone-850'
                  }`}
                >
                  {blockedUsers.includes('manimuhammad000@gmail.com') ? 'Blocked 🚫' : 'Block User'}
                </button>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <span className="block font-bold">owner-alkawthar@gmail.com</span>
                  <span className="text-[9px] text-gray-550 block">Business Owner status • Al-Kawthar Grocery linked</span>
                </div>
                <button
                  onClick={() => toggleBlockUser('owner-alkawthar@gmail.com')}
                  className={`px-2.5 py-1 text-[9px] font-bold rounded ${
                    blockedUsers.includes('owner-alkawthar@gmail.com')
                      ? 'bg-red-600 text-black'
                      : 'bg-stone-900 text-red-400 hover:bg-stone-850'
                  }`}
                >
                  {blockedUsers.includes('owner-alkawthar@gmail.com') ? 'Blocked 🚫' : 'Block User'}
                </button>
              </div>
            </div>
          </div>

          {/* Abuse reporting index */}
          <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#FFA500] flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Community Integrity & Feedback Reports
            </h4>

            <div className="space-y-2" id="admin-reports-list">
              {userReportLogs.map((rep) => (
                <div key={rep.id} className="p-3 rounded-xl bg-[#0F0E0C] border border-red-950/20 space-y-1 text-xs">
                  <div className="flex justify-between text-[9px] text-gray-500">
                    <span>Date: {rep.date}</span>
                    <span className="font-bold text-red-400 text-right">UNRESOLVED</span>
                  </div>
                  <p>
                    <strong className="text-white">Reporter:</strong> {rep.reporter}
                  </p>
                  <p>
                    <strong className="text-white">Flagged Listing:</strong> {rep.target}
                  </p>
                  <p className="text-gray-400 text-[11px] leading-relaxed mt-1">
                    <strong className="text-gray-350">Incident details: </strong>
                    "{rep.reason}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
