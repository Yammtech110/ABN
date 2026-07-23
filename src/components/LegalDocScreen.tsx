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
    <div className="min-h-full flex flex-col" id={`legal-page-${docId}`}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 border-b border-[#2D2319] bg-[#0F0E0C]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full bg-[#191613] border border-[#2D2319] hover:border-[#FFA048]/40 transition-colors"
          aria-label="Back"
          id="legal-page-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black uppercase tracking-wider text-[#F4E3D7] flex items-center gap-2 truncate">
            <Lock className="w-4 h-4 text-[#FFA048] shrink-0" />
            <span className="truncate">{doc.title}</span>
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5">Updated {doc.updated}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 pb-8">
        {doc.sections.map((s) => (
          <section
            key={s.heading}
            className="rounded-2xl border border-[#2D2319] bg-[#13110E] px-4 py-3.5"
          >
            <h2 className="text-[12px] font-bold text-[#F4E3D7] mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#FFA048] shrink-0" />
              {s.heading}
            </h2>
            <p className="text-[11px] text-gray-400 leading-relaxed">{s.body}</p>
          </section>
        ))}

        <a
          href={publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#FFA048]/15 border border-[#FFA048]/35 text-[10px] font-bold uppercase tracking-wide text-[#FFA048]"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open full page
        </a>
        <p className="text-[9px] text-gray-600 text-center">{SUPPORT_EMAIL}</p>
      </div>
    </div>
  );
};
