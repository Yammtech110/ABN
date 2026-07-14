import React, { useEffect, useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { apiFetch } from '../lib/api';
import { TRANSLATIONS } from '../data/translations';
import { Job, JobCategory } from '../types';
import { canPostJobs, getUserListing } from '../utils/listingAccess';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  Mail,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const JOB_CATEGORIES: JobCategory[] = ['IT', 'Graphic Designing', 'Developer', 'Chef', 'Maid', 'Others'];

const CATEGORY_COLORS: Record<JobCategory, string> = {
  'IT':               'bg-blue-900/40 text-blue-300 border-blue-700/40',
  'Graphic Designing':'bg-purple-900/40 text-purple-300 border-purple-700/40',
  'Developer':        'bg-green-900/40 text-green-300 border-green-700/40',
  'Chef':             'bg-amber-900/40 text-amber-300 border-amber-700/40',
  'Maid':             'bg-pink-900/40 text-pink-300 border-pink-700/40',
  'Others':           'bg-gray-800/60 text-gray-300 border-gray-600/40',
};

interface JobManagementScreenProps {
  /** When embedded in Account tab — hides leave-screen back nav */
  embedded?: boolean;
  onBack?: () => void;
}

export const JobManagementScreen: React.FC<JobManagementScreenProps> = ({ embedded = false, onBack }) => {
  const {
    language, currentUser, businesses, jobs,
    addJob, updateJob, deleteJob, refreshJobs,
    hiringActive, apiToken, refreshDirectory, ensureBusinessListing, setHiringActive,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (apiToken) void refreshJobs(apiToken);
  }, [apiToken, refreshJobs]);

  const myListing = getUserListing(currentUser, businesses);
  const businessForHiring = myListing;
  const canManageJobs = canPostJobs(myListing);
  const isHiring = businessForHiring ? (hiringActive[businessForHiring.id] ?? false) : false;
  const myJobs = jobs.filter((j) => j.businessId === businessForHiring?.id);

  const [view,       setView]       = useState<'list' | 'form'>('list');
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);

  const [formTitle,        setFormTitle]        = useState('');
  const [formCategory,     setFormCategory]     = useState<JobCategory>('Others');
  const [formRequirements, setFormRequirements] = useState('');
  const [formSalaryMin,    setFormSalaryMin]    = useState('');
  const [formSalaryMax,    setFormSalaryMax]    = useState('');
  const [formEmail,        setFormEmail]        = useState('');
  const [formSuccess,      setFormSuccess]      = useState('');
  const [formError,        setFormError]        = useState('');
  const [hiringBusy,       setHiringBusy]       = useState(false);

  const openNewForm = () => {
    setEditingJob(null); setFormTitle(''); setFormCategory('Others');
    setFormRequirements(''); setFormSalaryMin(''); setFormSalaryMax('');
    setFormEmail(''); setFormSuccess(''); setFormError(''); setView('form');
  };

  const openEditForm = (job: Job) => {
    setEditingJob(job); setFormTitle(job.title); setFormCategory(job.category);
    setFormRequirements(job.requirements); setFormSalaryMin(String(job.salaryMin));
    setFormSalaryMax(String(job.salaryMax)); setFormEmail(job.hiringEmail);
    setFormSuccess(''); setFormError(''); setView('form');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    let activeBusiness = myListing;
    if (!activeBusiness) {
      activeBusiness = await ensureBusinessListing();
    }
    if (!activeBusiness || !canPostJobs(activeBusiness)) {
      setFormError(
        language === 'en'
          ? 'Only approved business listings can post jobs.'
          : 'يمكن فقط للأعمال التجارية المعتمدة نشر الوظائف.',
      );
      return;
    }
    if (!isHiring) {
      setFormError(language === 'en'
        ? 'Turn on Hiring Active in Account before posting jobs.'
        : 'فعّل التوظيف من الحساب قبل نشر الوظائف.');
      return;
    }
    if (!formTitle.trim()) { setFormError('Job title is required.'); return; }
    if (!formEmail.trim() || !formEmail.includes('@')) { setFormError('A valid hiring email is required.'); return; }
    const min = parseInt(formSalaryMin, 10);
    const max = parseInt(formSalaryMax, 10);
    if (isNaN(min) || isNaN(max) || min <= 0 || max < min) {
      setFormError('Please enter a valid salary range (min ≤ max).');
      return;
    }

    setIsLoading(true);

    // ── Try live Supabase-backed API first ──────────────────────────────
    if (apiToken) {
      try {
        const url    = editingJob ? `/api/jobsboard/${editingJob.id}` : '/api/jobsboard';
        const method = editingJob ? 'PUT' : 'POST';
        const res = await apiFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
          body: JSON.stringify({
            title: formTitle.trim(), category: formCategory,
            requirements: formRequirements.trim(),
            salaryMin: min, salaryMax: max,
            hiringEmail: formEmail.trim(),
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          const mapped: Job = {
            id:               String(saved.id ?? editingJob?.id ?? ''),
            businessId:       String(saved.businessId ?? activeBusiness.id),
            businessName:     String(saved.businessName ?? activeBusiness.name),
            businessLogoUrl:  String(saved.businessLogoUrl ?? activeBusiness.logoUrl),
            title:            String(saved.title ?? formTitle.trim()),
            category:         (saved.category ?? formCategory) as JobCategory,
            requirements:     String(saved.requirements ?? formRequirements.trim()),
            salaryMin:        Number(saved.salaryMin ?? min),
            salaryMax:        Number(saved.salaryMax ?? max),
            hiringEmail:      String(saved.hiringEmail ?? formEmail.trim()),
            postedDate:       String(saved.postedDate ?? new Date().toISOString().split('T')[0]),
            isActive:         saved.isActive !== false,
          };
          if (editingJob) updateJob(mapped);
          else addJob(mapped);
          await refreshJobs(apiToken);
          await refreshDirectory();
          setFormSuccess(editingJob ? 'Job updated!' : 'Job posted!');
          setIsLoading(false);
          setTimeout(() => { setView('list'); setFormSuccess(''); }, 1100);
          return;
        }
        const err = await res.json();
        setFormError(err.error || 'Could not save job.');
        setIsLoading(false);
        return;
      } catch {
        setFormError('Cannot reach server. Make sure the backend is running.');
        setIsLoading(false);
        return;
      }
    }

    setFormError('You must be signed in to manage jobs.');
    setIsLoading(false);
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm('Delete this job posting?')) return;

    // ── Try live API first ──────────────────────────────────────────────
    if (apiToken) {
      try {
        const res = await apiFetch(`/api/jobsboard/${jobId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        if (res.ok || res.status === 204) {
          deleteJob(jobId);
          await refreshJobs(apiToken);
          await refreshDirectory();
          return;
        }
        alert('Could not delete job on server.');
      } catch {
        alert('Cannot reach server. Make sure the backend is running.');
      }
      return;
    }
    alert('You must be signed in to delete jobs.');
  };

  const handleHiringToggle = async () => {
    if (!businessForHiring) return;
    setHiringBusy(true);
    try {
      await setHiringActive(businessForHiring.id, !isHiring);
    } finally {
      setHiringBusy(false);
    }
  };

  if (!canManageJobs) {
    return (
      <div className="space-y-4 p-4" id="job-management-denied">
        {!embedded && onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
          </button>
        )}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-900/20 border border-amber-700/40">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#F4E3D7]">
              {language === 'en' ? 'Job posting unavailable' : 'نشر الوظائف غير متاح'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {language === 'en'
                ? 'Register and get approved as a business to post jobs.'
                : 'سجّل واعتمد كعمل تجاري لنشر الوظائف.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM VIEW ─────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="space-y-5" id="job-form-view">
        <div className="flex items-center gap-3 pb-3 border-b border-[#2D2319]">
          <button
            onClick={() => setView('list')}
            className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
            aria-label="Back to job list"
          >
            <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
          </button>
          <div>
            <h2 className="text-sm font-extrabold text-[#F4E3D7]">
              {editingJob ? (language === 'en' ? 'Edit Job Posting' : 'تعديل إعلان الوظيفة') : (language === 'en' ? 'Post a New Job' : 'نشر وظيفة جديدة')}
            </h2>
            <p className="text-[9px] text-gray-500">{businessForHiring?.name ?? currentUser?.name}</p>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4 p-5 rounded-3xl bg-[#13110E] border border-[#2D2319]">
          {formSuccess && (
            <p className="p-3 bg-green-950/45 border border-green-900 text-green-300 text-xs rounded-xl">{formSuccess}</p>
          )}
          {formError && (
            <p className="p-3 bg-red-950/45 border border-red-900 text-red-300 text-xs rounded-xl">{formError}</p>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {language === 'en' ? 'Job Title*' : 'المسمى الوظيفي*'}
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={language === 'en' ? 'e.g. Senior Web Developer' : 'مثال: مطور ويب أول'}
                required
                className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40"
              />
            </div>
            <div>
              <label className="block text-xs app-label mb-1">
                {language === 'en' ? 'Job Category*' : 'تصنيف الوظيفة*'}
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as JobCategory)}
                className="w-full p-2.5 rounded-xl border text-xs app-field outline-none"
              >
                {JOB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {language === 'en' ? 'Requirements & Skills' : 'المتطلبات والمهارات'}
            </label>
            <textarea
              value={formRequirements}
              onChange={(e) => setFormRequirements(e.target.value)}
              rows={4}
              placeholder={language === 'en' ? 'List required skills, experience, qualifications...' : 'أدرج المهارات والخبرات والمؤهلات المطلوبة...'}
              className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">
              {language === 'en' ? 'Salary Range (per month, USD)*' : 'نطاق الراتب (شهرياً، دولار)*'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  value={formSalaryMin}
                  onChange={(e) => setFormSalaryMin(e.target.value)}
                  placeholder={language === 'en' ? 'Min — e.g. 1500' : 'الأدنى'}
                  min="0"
                  required
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={formSalaryMax}
                  onChange={(e) => setFormSalaryMax(e.target.value)}
                  placeholder={language === 'en' ? 'Max — e.g. 3500' : 'الأقصى'}
                  min="0"
                  required
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {language === 'en' ? 'Hiring Email Address*' : 'البريد الإلكتروني للتوظيف*'}
            </label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="recruitment@yourbusiness.com"
              required
              className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]/40"
            />
            <p className="text-[9px] text-gray-500 mt-1">
              {language === 'en' ? 'Applicants will send their CVs directly to this email.' : 'سيرسل المتقدمون سيرتهم الذاتية مباشرةً إلى هذا البريد.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold rounded-xl text-xs transition-all shadow-md mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{language === 'en' ? 'Saving…' : 'جارٍ الحفظ…'}</>
              : editingJob
                ? (language === 'en' ? 'Save Changes' : 'حفظ التعديلات')
                : (language === 'en' ? '📮 Publish Job Opening' : '📮 نشر الإعلان')}
          </button>
        </form>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────
  return (
    <div className={`space-y-4 ${embedded ? '' : 'space-y-5'}`} id="job-management-list">
      {!embedded && (
        <div className="flex items-center gap-3 pb-3 border-b border-[#2D2319]">
          <button
            onClick={onBack}
            className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold text-[#F4E3D7]">
              {language === 'en' ? '💼 Job Openings' : '💼 الوظائف المتاحة'}
            </h2>
            <p className="text-[9px] text-gray-500">
              {businessForHiring?.name ?? currentUser?.name} · {myJobs.length} {language === 'en' ? `posting${myJobs.length !== 1 ? 's' : ''}` : 'إعلان'}
            </p>
          </div>
          {isHiring && (
            <button
              onClick={openNewForm}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFA048] text-black text-xs font-extrabold transition-all hover:bg-opacity-90 flex-shrink-0"
              id="btn-add-new-job"
            >
              <Plus className="w-3.5 h-3.5" />
              {language === 'en' ? 'New Job' : 'وظيفة'}
            </button>
          )}
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[#FFA048] uppercase tracking-wider">
              {language === 'en' ? 'Manage Job Openings' : 'إدارة الوظائف'}
            </p>
            <p className="text-[9px] text-gray-500 truncate">
              {businessForHiring?.name ?? currentUser?.name} · {myJobs.length} {language === 'en' ? `posting${myJobs.length !== 1 ? 's' : ''}` : 'إعلان'}
            </p>
          </div>
          {isHiring && (
            <button
              onClick={openNewForm}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFA048] text-black text-[10px] font-extrabold transition-all hover:bg-opacity-90 flex-shrink-0"
              id="btn-add-new-job-inline"
            >
              <Plus className="w-3.5 h-3.5" />
              {language === 'en' ? 'New Job' : 'وظيفة'}
            </button>
          )}
        </div>
      )}

      {!isHiring && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-700/30 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300 font-bold">
              {language === 'en' ? 'Hiring is Currently Paused' : 'التوظيف متوقف حالياً'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {language === 'en'
                ? 'Turn on "Hiring Active" below to publish job openings on the home feed.'
                : 'فعّل "التوظيف نشط" أدناه لنشر الوظائف على الصفحة الرئيسية.'}
            </p>
          </div>
        </div>
      )}

      {myJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#13110E] border border-[#2D2319] flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-sm font-bold text-gray-400">
            {language === 'en' ? 'No job postings yet' : 'لا توجد إعلانات بعد'}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            {isHiring
              ? (language === 'en' ? 'Tap "+ New Job" above to post your first opening' : 'اضغط "وظيفة +" للبدء')
              : (language === 'en' ? 'Enable hiring to start posting jobs' : 'فعّل التوظيف أولاً')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {myJobs.map((job) => (
            <div
              key={job.id}
              className="p-4 rounded-2xl bg-[#13110E] border border-[#2D2319] space-y-2.5"
              id={`job-card-mgmt-${job.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-extrabold text-white truncate">{job.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[job.category]}`}>
                      {job.category}
                    </span>
                    <span className="text-[9px] font-extrabold text-green-400">
                      ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEditForm(job)}
                    className="p-1.5 rounded-lg bg-[#191613] border border-[#2D2319] hover:border-[#FFA048]/40 transition-all"
                    aria-label="Edit job"
                  >
                    <Pencil className="w-3 h-3 text-gray-400 hover:text-[#FFA048]" />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="p-1.5 rounded-lg bg-[#191613] border border-[#2D2319] hover:border-red-500/40 transition-all"
                    aria-label="Delete job"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>

              {job.requirements && (
                <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{job.requirements}</p>
              )}

              <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#2D2319]/60">
                <Mail className="w-3 h-3 text-[#FFA048] flex-shrink-0" />
                <span className="text-[9px] text-gray-500 truncate">{job.hiringEmail}</span>
                <span className="ml-auto text-[8px] text-gray-600 flex-shrink-0">
                  {language === 'en' ? 'Posted' : 'نُشر'} {job.postedDate}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {businessForHiring && (
        <div className="p-4 rounded-2xl bg-[#13110E] border border-[#2D2319] flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white">Hiring Active</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {isHiring
                ? 'Your job posts appear on Home and the Job Board.'
                : 'Turn on to publish job openings on the home feed.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isHiring}
            disabled={hiringBusy}
            onClick={handleHiringToggle}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              isHiring ? 'bg-[#FFA048]' : 'bg-stone-700'
            } ${hiringBusy ? 'opacity-60' : ''}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isHiring ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
};
