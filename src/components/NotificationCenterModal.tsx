import React from 'react';
import { Bell, RefreshCw, Trash2, X } from 'lucide-react';
import { AppNotification } from '../types';
import {
  classifyNotification,
  formatNotificationRole,
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

/** Hide OTP / password-reset noise from the inbox (email already carries the code). */
const isSensitiveAuthNoise = (n: AppNotification) => {
  const t = `${n.title} ${n.message}`.toLowerCase();
  return (
    t.includes('verification code') ||
    t.includes('6-digit') ||
    t.includes('password reset code') ||
    t.includes('verify your email')
  );
};

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  notifications,
  loading = false,
  error = '',
  onClose,
  onRefresh,
  onClearAll,
}) => {
  const visible = notifications.filter((n) => !isSensitiveAuthNoise(n));

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
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#2D2319]/80">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#FFA048] flex items-center gap-2">
            <Bell className="w-4.5 h-4.5" />
            Notifications
            {visible.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FFA048]/15 text-[#FFA048] font-bold">
                {visible.length}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-full text-[#8A7A68] hover:text-[#FFA048] hover:bg-white/5 disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {visible.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="p-2 rounded-full text-[#8A7A68] hover:text-red-400 hover:bg-red-950/30"
                aria-label="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[#8A7A68] hover:text-white hover:bg-white/5"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-5 mt-3 text-[11px] text-red-300 bg-red-950/40 border border-red-900/40 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
          {loading && visible.length === 0 && (
            <p className="text-xs text-[#8A7A68] py-12 text-center">Loading notifications…</p>
          )}

          {!loading && visible.length === 0 && !error && (
            <div className="text-center py-12 px-4">
              <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#FFA048]/10 border border-[#FFA048]/20 flex items-center justify-center">
                <Bell className="w-6 h-6 text-[#FFA048]/70" />
              </div>
              <p className="text-xs text-[#C9A887] font-semibold">No notifications yet</p>
              <p className="text-[10px] text-[#7A6A5A] mt-2 leading-relaxed">
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
                className={`rounded-2xl border px-3.5 py-3 transition-colors ${
                  n.isRead
                    ? 'bg-black/20 border-[#2D2319]/70'
                    : 'bg-[#FFA048]/08 border-[#FFA048]/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[9px] mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-[#8A7A68]">{n.date || 'Today'}</span>
                    <span className="text-[#5A4A3A]">•</span>
                    <span className="text-[#FFA048] font-bold uppercase tracking-wider truncate">
                      {notificationKindLabel(kind)}
                    </span>
                  </div>
                  <span className="uppercase tracking-wider text-[#7A6A5A] bg-black/30 px-1.5 py-0.5 rounded shrink-0">
                    {formatNotificationRole(n.receiverRole)}
                  </span>
                </div>
                <h4 className="text-[12px] font-bold text-[#F8EDE3] leading-snug">{n.title}</h4>
                <p className="text-[11px] text-[#A89888] mt-1 leading-relaxed">{n.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
