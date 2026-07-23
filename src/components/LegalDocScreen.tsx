import React, { useCallback } from 'react';
import { ArrowLeft, ExternalLink, FileText, Lock } from 'lucide-react';
import { LEGAL_DOCS, LEGAL_PATHS, LegalDocId, SUPPORT_EMAIL } from '../data/legalContent';
import { useBackHandler } from '../context/BackNavigationContext';

interface LegalDocScreenProps {
  docId: LegalDocId;
  onBack: () => void;
}

/** Full-page legal / FAQ content (not a bottom sheet). */
export const LegalDocScreen: React.FC<LegalDocScreenProps> = ({ docId, onBack }) => {
  const doc = LEGAL_DOCS[docId];
  const publicPath = LEGAL_PATHS[docId];

  const handleBack = useCallback((): boolean => {
    onBack();
    return true;
  }, [onBack]);

  useBackHandler(`legal-doc-${docId}`, handleBack, true);

  return (
    <div className="page-shell min-h-full flex flex-col" id={`legal-page-${docId}`}>
      <div className="page-header sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="page-back-btn p-2 rounded-full transition-colors"
          aria-label="Back"
          id="legal-page-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="page-title text-sm font-black uppercase tracking-wider flex items-center gap-2 truncate">
            <Lock className="page-title-icon w-4 h-4 shrink-0" />
            <span className="truncate">{doc.title}</span>
          </h1>
          <p className="page-meta text-[10px] mt-0.5">Updated {doc.updated}</p>
        </div>
      </div>

      <div className="page-body flex-1 px-4 py-4 space-y-3 pb-8">
        {doc.sections.map((s) => (
          <section key={s.heading} className="page-card rounded-2xl px-4 py-3.5">
            <h2 className="page-card-title text-[12px] font-bold mb-1.5 flex items-center gap-1.5">
              <FileText className="page-title-icon w-3.5 h-3.5 shrink-0" />
              {s.heading}
            </h2>
            <p className="page-card-body text-[11px] leading-relaxed">{s.body}</p>
          </section>
        ))}

        <a
          href={publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="page-cta flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wide"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open full page
        </a>
        <p className="page-meta text-[9px] text-center">{SUPPORT_EMAIL}</p>
      </div>
    </div>
  );
};
