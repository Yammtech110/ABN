import React from 'react';

type ExitConfirmDialogProps = {
  open: boolean;
  onStay: () => void;
  onExit: () => void;
};

/** Native-style exit confirmation for Android back on root screens */
export const ExitConfirmDialog: React.FC<ExitConfirmDialogProps> = ({
  open,
  onStay,
  onExit,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6"
      id="exit-app-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-app-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#13110E] border border-[#2D2319] p-5 shadow-2xl">
        <h2 id="exit-app-title" className="text-base font-extrabold text-[#F4E3D7]">
          Exit ABN?
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Are you sure you want to close the app?
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onStay}
            className="flex-1 py-2.5 rounded-xl border border-[#2D2319] text-sm font-bold text-gray-300 hover:bg-[#191613] transition-colors"
            id="btn-exit-cancel"
          >
            No
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex-1 py-2.5 rounded-xl bg-[#FFA048] text-sm font-extrabold text-black hover:bg-opacity-90 transition-colors"
            id="btn-exit-confirm"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};
