import React, { useCallback } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { LEGAL_DOCS, LegalDocId } from '../data/legalContent';
import { useBackHandler } from '../context/BackNavigationContext';

interface LegalDocScreenProps {
  docId: LegalDocId;
  onBack: () => void;
}

/** Full-bleed legal / FAQ page — continuous document, not stacked cards. */
export const LegalDocScreen: React.FC<LegalDocScreenProps> = ({ docId, onBack }) => {
  const doc = LEGAL_DOCS[docId];

  const handleBack = useCallback((): boolean => {
    onBack();
    return true;
  }, [onBack]);

  useBackHandler(`legal-doc-${docId}`, handleBack, true);

  return (
    <div
      className="page-shell min-h-full flex flex-col bg-[#171310]"
      id={`legal-page-${docId}`}
    >
      <div className="page-header sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-[#171310] border-b border-[#2B231D]">
        <button
          type="button"
          onClick={onBack}
          className="page-back-btn p-2 rounded-full transition-colors"
          aria-label="Back"
          id="legal-page-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#F08C32]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="page-title text-sm font-black uppercase tracking-wider flex items-center gap-2 truncate text-[#FFFFFF]">
            <Lock className="page-title-icon w-4 h-4 shrink-0 text-[#F08C32]" />
            <span className="truncate">{doc.title}</span>
          </h1>
          <p className="page-meta text-[11px] mt-0.5 font-semibold text-[#CFCFCF]">
            Updated {doc.updated}
          </p>
        </div>
      </div>

      <article className="page-body flex-1 px-5 py-5 pb-10 bg-[#171310]" id={`legal-article-${docId}`}>
        {doc.sections.map((s, i) => (
          <section
            key={s.heading}
            className={`py-4 ${i < doc.sections.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
          >
            <h2 className="text-[13px] font-extrabold text-[#FFFFFF] mb-2">{s.heading}</h2>
            <p className="text-[12px] leading-relaxed text-slate-700">{s.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
};
