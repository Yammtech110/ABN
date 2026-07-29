import React, { useCallback, useEffect } from 'react';
import { ArrowLeft, Bell, RefreshCw, Trash2 } from 'lucide-react';
import { useDirectory } from '../context/DirectoryContext';
import { useBackHandler } from '../context/BackNavigationContext';
import {
  classifyNotification,
  countUnreadNotifications,
  filterNotificationsForUser,
  formatNotificationRole,
  notificationKindColor,
  notificationKindLabel,
} from '../utils/notifications';

interface NotificationsScreenProps {
  onBack: () => void;
}

/** Full-bleed notifications inbox — continuous list, not stacked cards. */
export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack }) => {
  const {
    currentUser,
    notifications,
    notificationsLoading,
    notificationsError,
    refreshNotifications,
    markNotificationsAsRead,
    clearNotifications,
  } = useDirectory();

  const visible = filterNotificationsForUser(notifications, currentUser).filter((n) => {
    const t = `${n.title} ${n.message}`.toLowerCase();
    return !(
      t.includes('verification code') ||
      t.includes('6-digit') ||
      t.includes('password reset code') ||
      t.includes('verify your email')
    );
  });
  const unread = countUnreadNotifications(notifications, currentUser);

  useEffect(() => {
    void refreshNotifications();
    void markNotificationsAsRead();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = useCallback((): boolean => {
    onBack();
    return true;
  }, [onBack]);

  useBackHandler('notifications-screen', handleBack, true);

  const handleClearAll = async () => {
    if (!confirm('Clear all notifications from your inbox?')) return;
    await clearNotifications();
    await refreshNotifications();
  };

  return (
    <div className="page-shell min-h-full flex flex-col bg-white" id="notifications-page">
      <div className="page-header sticky top-0 z-10 flex items-center gap-2 px-4 py-3.5 bg-white border-b border-[#D7E0EA]">
        <button
          type="button"
          onClick={onBack}
          className="page-back-btn p-2 rounded-full transition-colors"
          aria-label="Back"
          id="notifications-page-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#EA580C]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="page-title text-sm font-black uppercase tracking-wider flex items-center gap-2 text-[#7C2D12]">
            <Bell className="page-title-icon w-4 h-4 text-[#EA580C]" />
            Notifications
            {unread > 0 && (
              <span className="page-badge text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                {unread}
              </span>
            )}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => refreshNotifications()}
          disabled={notificationsLoading}
          className="page-icon-btn p-2 rounded-full disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${notificationsLoading ? 'animate-spin' : ''}`} />
        </button>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={() => void handleClearAll()}
            className="page-icon-btn page-icon-btn-danger p-2 rounded-full"
            aria-label="Clear all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="page-body flex-1 bg-white pb-8">
        {notificationsError && (
          <p className="page-error text-[11px] mx-4 mt-4 rounded-xl px-3 py-2">{notificationsError}</p>
        )}

        {notificationsLoading && visible.length === 0 && (
          <p className="text-xs py-16 text-center font-semibold text-slate-600">Loading notifications…</p>
        )}

        {!notificationsLoading && visible.length === 0 && !notificationsError && (
          <div className="text-center py-16 px-6">
            <div className="page-empty-icon mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-[#EA580C]" />
            </div>
            <p className="text-xs font-extrabold text-[#7C2D12]">No notifications yet</p>
            <p className="text-[11px] mt-2 leading-relaxed text-slate-600">
              Listing approvals, payments, membership alerts, and admin updates will appear here.
            </p>
          </div>
        )}

        <ul className="divide-y divide-[#E2E8F0]">
          {visible.map((n) => {
            const kind = classifyNotification(n);
            const dotColor = notificationKindColor(kind);
            return (
              <li
                key={n.id}
                className={`px-4 py-3.5 ${n.isRead ? 'bg-white' : 'bg-orange-50/50'}`}
              >
                <div className="flex items-center justify-between gap-2 text-[9px] mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="font-semibold text-slate-600">{n.date || 'Today'}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold uppercase tracking-wider truncate text-[#EA580C]">
                      {notificationKindLabel(kind)}
                    </span>
                  </div>
                  <span className="uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-slate-100 text-slate-600 font-bold">
                    {formatNotificationRole(n.receiverRole)}
                  </span>
                </div>
                <h2 className="text-[12px] font-extrabold leading-snug text-[#7C2D12]">{n.title}</h2>
                <p className="text-[11px] mt-1 leading-relaxed text-slate-700">{n.message}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
