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
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-[28px] overflow-hidden border border-[#3A2E22] shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        style={{ background: 'linear-gradient(180deg, #1A1510 0%, #100C09 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#2D2319]/80">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#FFA048] flex items-center gap-2">
              <Lock className="w-4.5 h-4.5 shrink-0" />
              <span className="truncate">{doc.title}</span>
            </h3>
            <p className="text-[10px] text-[#8A7A68] mt-1">Updated {doc.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#8A7A68] hover:text-white hover:bg-white/5 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {doc.sections.map((s) => (
            <section key={s.heading} className="rounded-2xl border border-[#2D2319] bg-black/25 px-3.5 py-3">
              <h4 className="text-[12px] font-bold text-[#F8EDE3] mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#FFA048]/80" />
                {s.heading}
              </h4>
              <p className="text-[11px] text-[#B9A896] leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[#2D2319]/80 space-y-2">
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#FFB35C]/15 to-[#FF8F2E]/10 border border-[#FFA048]/30 text-[10px] font-bold uppercase tracking-wide text-[#FFA048]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open full page
          </a>
          <p className="text-[9px] text-[#6A5A4A] text-center">{SUPPORT_EMAIL}</p>
        </div>
      </div>
    </div>
  );
};
