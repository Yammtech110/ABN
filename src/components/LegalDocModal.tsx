import React from 'react';
import { LEGAL_DOCS, LegalDocId } from '../data/legalContent';
import { Lock, FileText, X } from 'lucide-react';

interface LegalDocModalProps {
  docId: LegalDocId;
  onClose: () => void;
}

export const LegalDocModal: React.FC<LegalDocModalProps> = ({ docId, onClose }) => {
  const doc = LEGAL_DOCS[docId];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-doc-sheet-title"
      onClick={onClose}
    >
      <div
        id="legal-doc-sheet"
        data-sheet="legal"
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-[28px] overflow-hidden border border-[#2B231D] shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        style={{ background: 'linear-gradient(180deg, #171310 0%, #0D0906 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#2B231D]">
          <div className="min-w-0">
            <h3
              id="legal-doc-sheet-title"
              className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white"
            >
              <Lock className="w-4.5 h-4.5 shrink-0 text-[#F08C32]" />
              <span className="truncate">{doc.title}</span>
            </h3>
            <p className="text-[10px] mt-1 text-[#8E8E8E]">Updated {doc.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#CFCFCF] hover:text-white shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {doc.sections.map((s) => (
            <section
              key={s.heading}
              className="rounded-2xl border border-[#2B231D] bg-[#1E1915] px-4 py-3.5"
            >
              <h4 className="text-[12px] font-bold mb-1.5 flex items-center gap-1.5 text-white">
                <FileText className="w-3.5 h-3.5 text-[#F08C32] shrink-0" />
                {s.heading}
              </h4>
              <p className="text-[11px] leading-relaxed text-[#CFCFCF]">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
