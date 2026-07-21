import React from 'react';
import { LEGAL_DOCS, LEGAL_PATHS, LegalDocId, SUPPORT_EMAIL } from '../data/legalContent';
import { ExternalLink } from 'lucide-react';

interface LegalDocModalProps {
  docId: LegalDocId;
  onClose: () => void;
}

export const LegalDocModal: React.FC<LegalDocModalProps> = ({ docId, onClose }) => {
  const doc = LEGAL_DOCS[docId];
  const publicPath = LEGAL_PATHS[docId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id={`legal-modal-${docId}`}>
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-[#13110E] border border-[#2D2319] p-6 text-[#F4E3D7]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-xs text-gray-500 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
        <h3 className="text-sm font-black uppercase tracking-wider text-[#FFA048] mb-1 pr-8">{doc.title}</h3>
        <p className="text-[10px] text-gray-500 mb-3">Updated {doc.updated}</p>
        <div className="text-xs text-gray-400 leading-relaxed space-y-3.5 overflow-y-auto pr-1 flex-1">
          {doc.sections.map((s) => (
            <div key={s.heading}>
              <h4 className="text-[#F4E3D7] font-bold mb-1">{s.heading}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
        <a
          href={publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#FFA048] hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Open full page
        </a>
        <p className="text-[9px] text-gray-600 text-center mt-2">{SUPPORT_EMAIL}</p>
      </div>
    </div>
  );
};
