import React, { useState, useMemo, useCallback } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { useBackHandler } from '../context/BackNavigationContext';
import { TRANSLATIONS } from '../data/translations';
import { Job, JobCategory } from '../types';
import { BusinessThumbnail } from './BusinessThumbnail';
import {
  ArrowLeft,
  Briefcase,
  Mail,
  ChevronRight,
  Building2,
  DollarSign,
} from 'lucide-react';

export const JOB_CATEGORIES: JobCategory[] = ['IT', 'Graphic Designing', 'Developer', 'Chef', 'Maid', 'Others'];

export const CATEGORY_COLORS: Record<JobCategory, string> = {
  'IT':               'bg-blue-900/40 text-blue-300 border-blue-700/40',
  'Graphic Designing':'bg-purple-900/40 text-purple-300 border-purple-700/40',
  'Developer':        'bg-green-900/40 text-green-300 border-green-700/40',
  'Chef':             'bg-amber-900/40 text-amber-300 border-amber-700/40',
  'Maid':             'bg-pink-900/40 text-pink-300 border-pink-700/40',
  'Others':           'bg-gray-800/60 text-gray-300 border-gray-600/40',
};

interface JobBoardScreenProps {
  onBack: () => void;
  initialJobId?: string | null;
}

export const JobBoardScreen: React.FC<JobBoardScreenProps> = ({ onBack, initialJobId }) => {
  const { language, jobs, hiringActive } = useDirectory();

  const [selectedCategory, setSelectedCategory] = useState<JobCategory | 'All'>('All');
  const [selectedJob, setSelectedJob] = useState<Job | null>(() => {
    if (initialJobId) {
      return jobs.find((j) => j.id === initialJobId) ?? null;
    }
    return null;
  });

  const publicJobs = useMemo(
    () => jobs.filter((j) => j.isActive && hiringActive[j.businessId] === true),
    [jobs, hiringActive]
  );

  const filteredJobs = useMemo(
    () =>
      selectedCategory === 'All'
        ? publicJobs
        : publicJobs.filter((j) => j.category === selectedCategory),
    [publicJobs, selectedCategory]
  );

  const handleJobDetailBack = useCallback((): boolean => {
    if (selectedJob) {
      setSelectedJob(null);
      return true;
    }
    return false;
  }, [selectedJob]);

  useBackHandler('job-board-detail', handleJobDetailBack, Boolean(selectedJob));

  // ── JOB DETAIL VIEW ──────────────────────────────────────────
  if (selectedJob) {
    return (
      <div className="space-y-5" id="job-detail-view">
        <div className="flex items-center gap-3 pb-3 border-b border-[#2D2319]">
          <button
            onClick={() => setSelectedJob(null)}
            className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
            aria-label="Back to job list"
          >
            <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
          </button>
          <h2 className="text-sm font-extrabold text-[#F4E3D7] flex-1 truncate">
            {language === 'en' ? 'Job Details' : 'تفاصيل الوظيفة'}
          </h2>
        </div>

        <div className="p-5 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-5">
          {/* Business identity header */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#0F0E0C] border border-[#2D2319] flex-shrink-0">
              <BusinessThumbnail
                business={{ id: selectedJob.businessId, name: selectedJob.businessName, logoUrl: selectedJob.businessLogoUrl }}
                className="w-full h-full object-cover"
                eager
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white leading-tight">{selectedJob.title}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <p className="text-[10px] text-gray-400 truncate">{selectedJob.businessName}</p>
              </div>
            </div>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[selectedJob.category]}`}>
              {selectedJob.category}
            </span>
            <span className="text-[10px] font-extrabold text-green-400 bg-green-900/20 border border-green-700/30 px-2.5 py-1 rounded-full flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {selectedJob.salaryMin.toLocaleString()} – ${selectedJob.salaryMax.toLocaleString()}/mo
            </span>
            <span className="text-[9px] text-gray-500 ml-auto">
              {language === 'en' ? 'Posted' : 'نُشر'} {selectedJob.postedDate}
            </span>
          </div>

          {/* Requirements */}
          <div>
            <h4 className="text-[10px] font-extrabold text-[#FFA048] uppercase tracking-wider mb-2">
              {language === 'en' ? 'Requirements & Skills' : 'المتطلبات والمهارات'}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
              {selectedJob.requirements || (language === 'en' ? 'No specific requirements listed.' : 'لا توجد متطلبات محددة.')}
            </p>
          </div>

          {/* Hiring email display */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319]">
            <Mail className="w-3.5 h-3.5 text-[#FFA048] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-gray-500">
                {language === 'en' ? 'Send your CV to' : 'أرسل سيرتك الذاتية إلى'}
              </p>
              <p className="text-xs text-white font-bold truncate">{selectedJob.hiringEmail}</p>
            </div>
          </div>

          {/* Email CTA */}
          <a
            href={`mailto:${selectedJob.hiringEmail}?subject=Job Application: ${encodeURIComponent(selectedJob.title)} at ${encodeURIComponent(selectedJob.businessName)}&body=Assalamu Alaykum,%0A%0AI am writing to apply for the ${encodeURIComponent(selectedJob.title)} position at ${encodeURIComponent(selectedJob.businessName)}.%0A%0APlease find my CV attached.%0A%0AThank you.`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-95 no-underline"
            id={`btn-apply-${selectedJob.id}`}
          >
            <Mail className="w-4 h-4" />
            {language === 'en' ? '📧 Apply via Email (Submit CV)' : '📧 التقديم بالبريد الإلكتروني'}
          </a>
        </div>
      </div>
    );
  }

  // ── JOB BOARD LIST VIEW ───────────────────────────────────────
  return (
    <div className="space-y-5" id="job-board-screen">
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
            {language === 'en' ? '🔥 All Job Openings' : '🔥 جميع الوظائف المتاحة'}
          </h2>
          <p className="text-[9px] text-gray-500">
            {publicJobs.length} {language === 'en' ? `active posting${publicJobs.length !== 1 ? 's' : ''} across the directory` : 'إعلان نشط في الدليل'}
          </p>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x" id="job-board-filter-row">
        {(['All', ...JOB_CATEGORIES] as const).map((cat) => {
          const count = cat === 'All' ? publicJobs.length : publicJobs.filter((j) => j.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all snap-start ${
                selectedCategory === cat
                  ? 'bg-[#FFA048] text-black border-[#FFA048] shadow-md'
                  : 'bg-[#13110E] text-gray-400 border-[#2D2319] hover:border-[#FFA048]/40 hover:text-white'
              }`}
              id={`job-filter-${cat}`}
            >
              {cat}
              <span className={`text-[9px] px-1 py-0.5 rounded-full font-black ${
                selectedCategory === cat ? 'bg-black/20 text-black' : 'bg-[#201B15] text-[#FFA048]'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#13110E] border border-[#2D2319] flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-sm font-bold text-gray-400">
            {language === 'en' ? 'No jobs in this category' : 'لا توجد وظائف في هذا التصنيف'}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            {language === 'en' ? 'Check back later or browse other categories' : 'تفقد لاحقاً أو تصفح تصنيفات أخرى'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" id="job-board-list">
          {filteredJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className="w-full p-4 rounded-2xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048]/30 transition-all text-left space-y-2.5 group"
              id={`job-board-card-${job.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#0F0E0C] border border-[#2D2319] flex-shrink-0">
                  <BusinessThumbnail
                    business={{ id: job.businessId, name: job.businessName, logoUrl: job.businessLogoUrl }}
                    className="w-full h-full object-cover"
                    eager
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-extrabold text-white group-hover:text-[#FFA048] transition-colors truncate">
                    {job.title}
                  </h3>
                  <p className="text-[9px] text-gray-500 mt-0.5">{job.businessName}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#FFA048] transition-colors flex-shrink-0 mt-0.5" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[job.category]}`}>
                  {job.category}
                </span>
                <span className="text-[9px] font-extrabold text-green-400">
                  ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                </span>
              </div>

              {job.requirements && (
                <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{job.requirements}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
