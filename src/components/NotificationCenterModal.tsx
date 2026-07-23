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
      aria-labelledby="notification-center-sheet-title"
      onClick={onClose}
    >
      <div
        id="notification-center-sheet"
        data-sheet="notifications"
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-[28px] overflow-hidden border border-[#3A2E22] shadow-[0_24px_60px_rgba(0,0,0,0.65)] sheet-panel"
        style={{ background: 'linear-gradient(180deg, #1A1510 0%, #100C09 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#2D2319]/80 sheet-panel-header">
          <h3
            id="notification-center-sheet-title"
            className="sheet-panel-title text-sm font-black uppercase tracking-wider flex items-center gap-2"
          >
            <Bell className="w-4.5 h-4.5 sheet-panel-icon" />
            Notifications
            {visible.length > 0 && (
              <span className="sheet-panel-badge text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                {visible.length}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-full sheet-panel-close disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {visible.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="p-2 rounded-full sheet-panel-close hover:!text-red-500"
                aria-label="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full sheet-panel-close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-5 mt-3 text-[11px] rounded-xl px-3 py-2 border border-red-300 bg-red-50 text-red-700 sheet-error">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0 sheet-panel-body">
          {loading && visible.length === 0 && (
            <p className="sheet-panel-meta text-xs py-12 text-center">Loading notifications…</p>
          )}

          {!loading && visible.length === 0 && !error && (
            <div className="text-center py-12 px-4">
              <div className="mx-auto mb-3 w-12 h-12 rounded-2xl sheet-empty-icon flex items-center justify-center">
                <Bell className="w-6 h-6 sheet-panel-icon" />
              </div>
              <p className="sheet-card-title text-xs font-semibold">No notifications yet</p>
              <p className="sheet-card-body text-[10px] mt-2 leading-relaxed">
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
                className={`sheet-card rounded-2xl border px-4 py-3.5 transition-colors ${
                  n.isRead ? 'sheet-card-read' : 'sheet-card-unread'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[9px] mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="sheet-panel-meta">{n.date || 'Today'}</span>
                    <span className="sheet-panel-meta opacity-50">•</span>
                    <span className="sheet-card-kind font-bold uppercase tracking-wider truncate">
                      {notificationKindLabel(kind)}
                    </span>
                  </div>
                  <span className="sheet-panel-meta uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-black/10">
                    {formatNotificationRole(n.receiverRole)}
                  </span>
                </div>
                <h4 className="sheet-card-title text-[12px] font-bold leading-snug">{n.title}</h4>
                <p className="sheet-card-body text-[11px] mt-1 leading-relaxed">{n.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
