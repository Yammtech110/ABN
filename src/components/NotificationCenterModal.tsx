import React from 'react';
import { Bell, RefreshCw, Trash2, X } from 'lucide-react';
import { AppNotification } from '../types';
import {
  classifyNotification,
  formatNotificationRole,
  isSensitiveAuthNotification,
  notificationKindColor,
  notificationKindLabel,
} from '../utils/notifications';

interface NotificationCenterModalProps {
  notifications: AppNotification[];
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onRefresh: () => void;
  onClearAll: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  notifications,
  loading = false,
  error = '',
  onClose,
  onRefresh,
  onClearAll,
}) => {
  const visible = notifications.filter((n) => !isSensitiveAuthNotification(n));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-center-sheet-title"
      onClick={onClose}
    >
      <div
        id="notification-center-sheet"
        data-sheet="notifications"
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-[28px] overflow-hidden border border-[#2B231D] shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        style={{ background: 'linear-gradient(180deg, #171310 0%, #0D0906 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#2B231D]/80">
          <h3
            id="notification-center-sheet-title"
            className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white"
          >
            <Bell className="w-4.5 h-4.5 text-[#F08C32]" />
            Notifications
            {visible.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#FF9E47] text-black">
                {visible.length}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-full text-[#CFCFCF] hover:text-white disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {visible.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="p-2 rounded-full text-[#E84D4D] hover:bg-[#1E1915]"
                aria-label="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[#CFCFCF] hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-5 mt-3 text-[11px] rounded-xl px-3 py-2 border border-[#E84D4D]/40 bg-[#E84D4D]/15 text-[#E84D4D]">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
          {loading && visible.length === 0 && (
            <p className="text-xs py-12 text-center text-[#CFCFCF]">Loading notifications…</p>
          )}

          {!loading && visible.length === 0 && !error && (
            <div className="text-center py-12 px-4">
              <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#1E1915] border border-[#2B231D] flex items-center justify-center">
                <Bell className="w-6 h-6 text-[#F08C32]" />
              </div>
              <p className="text-xs font-semibold text-white">No notifications yet</p>
              <p className="text-[10px] mt-2 leading-relaxed text-[#CFCFCF]">
                Listing approvals, payments, membership alerts, and admin updates will appear here.
              </p>
            </div>
          )}

          {visible.map((n) => {
            const kind = classifyNotification(n);
            const dotColor = notificationKindColor(kind);
            return (
              <div
                key={n.id}
                className={`rounded-2xl border px-4 py-3.5 transition-colors ${
                  n.isRead
                    ? 'bg-[#171310] border-[#2B231D]'
                    : 'bg-[#1E1915] border-[#F08C32]/35'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[9px] mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-[#8E8E8E]">{n.date || 'Today'}</span>
                    <span className="text-[#8E8E8E] opacity-50">•</span>
                    <span className="font-bold uppercase tracking-wider truncate text-[#F08C32]">
                      {notificationKindLabel(kind)}
                    </span>
                  </div>
                  <span className="uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-black/30 text-[#8E8E8E]">
                    {formatNotificationRole(n.receiverRole)}
                  </span>
                </div>
                <h4 className="text-[12px] font-bold leading-snug text-white">{n.title}</h4>
                <p className="text-[11px] mt-1 leading-relaxed text-[#CFCFCF]">{n.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
