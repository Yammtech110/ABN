import React, { useState, useMemo, useCallback } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { useBackHandler } from '../context/BackNavigationContext';
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
  'IT':               'bg-orange-900/40 text-orange-300 border-orange-700/40',
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

  if (selectedJob) {
    return (
      <div className="space-y-5 min-h-full bg-[#0D0906] px-4 pt-4 pb-8" id="job-detail-view">
        <div className="subpage-header sticky top-0 z-10 -mx-4 px-4 pt-1 flex items-center gap-3 pb-3 border-b border-[#2B231D] bg-[#0D0906]/95 backdrop-blur-md">
          <button
            onClick={() => setSelectedJob(null)}
            className="p-2 rounded-full bg-[#171310] hover:bg-[#1E1915] border border-[#2B231D] transition-colors"
            aria-label="Back to job list"
          >
            <ArrowLeft className="w-4 h-4 text-[#F08C32]" />
          </button>
          <h2 className="text-sm font-extrabold text-white flex-1 truncate">
            {language === 'en' ? 'Job Details' : 'تفاصيل الوظيفة'}
          </h2>
        </div>

        <div
          className="p-3.5 rounded-2xl border border-[#F08C32]/30 text-[11px] text-[#CFCFCF] leading-relaxed"
          style={{ background: 'rgba(240,140,50,0.08)' }}
          id="job-board-disclaimer"
        >
          Job posts are provided by third-party businesses. ABN is not the employer or recruiter and does not guarantee outcomes. Contact employers directly.
        </div>

        <div className="p-5 rounded-3xl bg-[#171310] border border-[#2B231D] space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#1E1915] border border-[#2B231D] flex-shrink-0">
              <BusinessThumbnail
                business={{ id: selectedJob.businessId, name: selectedJob.businessName, logoUrl: selectedJob.imageUrl || selectedJob.businessLogoUrl }}
                className="w-full h-full object-cover"
                eager
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white leading-tight">{selectedJob.title}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3 h-3 text-[#F08C32] flex-shrink-0" />
                <p className="text-[10px] text-[#8E8E8E] truncate">{selectedJob.businessName}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[selectedJob.category]}`}>
              {selectedJob.category}
            </span>
            <span className="text-[10px] font-extrabold text-[#F08C32] bg-[#FF9E47]/15 border border-[#F08C32]/40 px-2.5 py-1 rounded-full flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              ${selectedJob.salaryMin.toLocaleString()} – ${selectedJob.salaryMax.toLocaleString()}/mo
            </span>
            <span className="text-[9px] text-[#8E8E8E] ml-auto">
              {language === 'en' ? 'Posted' : 'نُشر'} {selectedJob.postedDate}
            </span>
          </div>

          <div>
            <h4 className="text-[10px] font-extrabold text-[#F08C32] uppercase tracking-wider mb-2">
              {language === 'en' ? 'Requirements & Skills' : 'المتطلبات والمهارات'}
            </h4>
            <p className="text-xs text-[#CFCFCF] leading-relaxed whitespace-pre-wrap">
              {selectedJob.requirements || (language === 'en' ? 'No specific requirements listed.' : 'لا توجد متطلبات محددة.')}
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#1E1915] border border-[#2B231D]">
            <Mail className="w-3.5 h-3.5 text-[#F08C32] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-[#8E8E8E]">
                {language === 'en' ? 'Send your CV to' : 'أرسل سيرتك الذاتية إلى'}
              </p>
              <p className="text-xs text-white font-bold truncate">{selectedJob.hiringEmail}</p>
            </div>
          </div>

          <a
            href={`mailto:${selectedJob.hiringEmail}?subject=Job Application: ${encodeURIComponent(selectedJob.title)} at ${encodeURIComponent(selectedJob.businessName)}&body=${encodeURIComponent(`Hello,\n\nI am writing to apply for the ${selectedJob.title} position at ${selectedJob.businessName}.\n\nPlease find my CV attached.\n\nBest regards`)}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#FF9E47] hover:bg-[#D9771D] text-black font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-95 no-underline"
            id={`btn-apply-${selectedJob.id}`}
          >
            <Mail className="w-4 h-4" />
            {language === 'en' ? 'Apply via Email (Submit CV)' : 'التقديم بالبريد الإلكتروني'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 min-h-full bg-[#0D0906] px-4 pt-4 pb-8" id="job-board-screen">
      <div className="subpage-header sticky top-0 z-10 -mx-4 px-4 pt-1 flex items-center gap-3 pb-3 border-b border-[#2B231D] bg-[#0D0906]/95 backdrop-blur-md">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-[#171310] hover:bg-[#1E1915] border border-[#2B231D] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4 text-[#F08C32]" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-extrabold text-white">
            {language === 'en' ? 'All Job Openings' : 'جميع الوظائف المتاحة'}
          </h2>
          <p className="text-[9px] text-[#8E8E8E]">
            {publicJobs.length} {language === 'en' ? `active posting${publicJobs.length !== 1 ? 's' : ''} across the directory` : 'إعلان نشط في الدليل'}
          </p>
        </div>
      </div>

      <div
        className="p-3.5 rounded-2xl border border-[#F08C32]/30 text-[11px] text-[#CFCFCF] leading-relaxed"
        style={{ background: 'rgba(240,140,50,0.08)' }}
        id="job-board-list-disclaimer"
      >
        Job posts are provided by third-party businesses. ABN is not the employer or recruiter and does not guarantee outcomes.
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x" id="job-board-filter-row">
        {(['All', ...JOB_CATEGORIES] as const).map((cat) => {
          const count = cat === 'All' ? publicJobs.length : publicJobs.filter((j) => j.category === cat).length;
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all snap-start ${
                active
                  ? 'bg-[#FF9E47] text-black border-[#F08C32] shadow-md'
                  : 'bg-[#171310] text-[#F08C32] border-[#F08C32]/45'
              }`}
              id={`job-filter-${cat}`}
            >
              {cat}
              <span
                className={`text-[9px] px-1 py-0.5 rounded-full font-black ${
                  active ? 'bg-black/15 text-black' : 'bg-[#1E1915] text-[#F08C32]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#171310] border border-[#2B231D] flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-[#F08C32]" />
          </div>
          <p className="text-sm font-bold text-[#CFCFCF]">
            {language === 'en' ? 'No jobs in this category' : 'لا توجد وظائف في هذا التصنيف'}
          </p>
          <p className="text-[10px] text-[#8E8E8E] mt-1">
            {language === 'en' ? 'Check back later or browse other categories' : 'تفقد لاحقاً أو تصفح تصنيفات أخرى'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" id="job-board-list">
          {filteredJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className="w-full p-4 rounded-2xl bg-[#171310] border border-[#2B231D] hover:border-[#F08C32]/40 transition-all text-left space-y-2.5 group"
              id={`job-board-card-${job.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#1E1915] border border-[#2B231D] flex-shrink-0">
                  <BusinessThumbnail
                    business={{ id: job.businessId, name: job.businessName, logoUrl: job.imageUrl || job.businessLogoUrl }}
                    className="w-full h-full object-cover"
                    eager
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-extrabold text-white group-hover:text-[#F08C32] transition-colors truncate">
                    {job.title}
                  </h3>
                  <p className="text-[9px] text-[#8E8E8E] mt-0.5">{job.businessName}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#8E8E8E] group-hover:text-[#F08C32] transition-colors flex-shrink-0 mt-0.5" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[job.category]}`}>
                  {job.category}
                </span>
                <span className="text-[9px] font-extrabold text-[#F08C32]">
                  ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}/mo
                </span>
              </div>

              {job.requirements && (
                <p className="text-[10px] text-[#8E8E8E] line-clamp-2 leading-relaxed">{job.requirements}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
