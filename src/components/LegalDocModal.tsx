import React from 'react';
import { LEGAL_DOCS, LEGAL_PATHS, LegalDocId, SUPPORT_EMAIL } from '../data/legalContent';
import { ExternalLink, Lock, FileText, X } from 'lucide-react';

interface LegalDocModalProps {
  docId: LegalDocId;
  onClose: () => void;
}

export const LegalDocModal: React.FC<LegalDocModalProps> = ({ docId, onClose }) => {
  const doc = LEGAL_DOCS[docId];
  const publicPath = LEGAL_PATHS[docId];

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
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-[28px] overflow-hidden border border-[#3A2E22] shadow-[0_24px_60px_rgba(0,0,0,0.65)] sheet-panel"
        style={{ background: 'linear-gradient(180deg, #1A1510 0%, #100C09 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#2D2319]/80 sheet-panel-header">
          <div className="min-w-0">
            <h3
              id="legal-doc-sheet-title"
              className="sheet-panel-title text-sm font-black uppercase tracking-wider flex items-center gap-2"
            >
              <Lock className="w-4.5 h-4.5 shrink-0 sheet-panel-icon" />
              <span className="truncate">{doc.title}</span>
            </h3>
            <p className="sheet-panel-meta text-[10px] mt-1">Updated {doc.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full sheet-panel-close shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 sheet-panel-body">
          {doc.sections.map((s) => (
            <section
              key={s.heading}
              className="sheet-card rounded-2xl border border-[#2D2319] bg-black/25 px-4 py-3.5"
            >
              <h4 className="sheet-card-title text-[12px] font-bold mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 sheet-card-icon shrink-0" />
                {s.heading}
              </h4>
              <p className="sheet-card-body text-[11px] leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[#2D2319]/80 space-y-2 sheet-panel-footer">
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="sheet-panel-cta flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border text-[10px] font-bold uppercase tracking-wide"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open full page
          </a>
          <p className="sheet-panel-meta text-[9px] text-center">{SUPPORT_EMAIL}</p>
        </div>
      </div>
    </div>
  );
};
