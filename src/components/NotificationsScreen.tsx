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

/** Full-page notifications inbox (not a bottom sheet). */
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
    <div className="min-h-full flex flex-col" id="notifications-page">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3.5 border-b border-[#2D2319] bg-[#0F0E0C]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full bg-[#191613] border border-[#2D2319] hover:border-[#FFA048]/40 transition-colors"
          aria-label="Back"
          id="notifications-page-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black uppercase tracking-wider text-[#F4E3D7] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#FFA048]" />
            Notifications
            {unread > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FFA048]/15 text-[#FFA048] font-bold">
                {unread}
              </span>
            )}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => refreshNotifications()}
          disabled={notificationsLoading}
          className="p-2 rounded-full text-gray-500 hover:text-[#FFA048] disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${notificationsLoading ? 'animate-spin' : ''}`} />
        </button>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={() => void handleClearAll()}
            className="p-2 rounded-full text-gray-500 hover:text-red-400"
            aria-label="Clear all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 pb-8">
        {notificationsError && (
          <p className="text-[11px] text-red-300 bg-red-950/40 border border-red-900/40 rounded-xl px-3 py-2">
            {notificationsError}
          </p>
        )}

        {notificationsLoading && visible.length === 0 && (
          <p className="text-xs text-gray-500 py-16 text-center">Loading notifications…</p>
        )}

        {!notificationsLoading && visible.length === 0 && !notificationsError && (
          <div className="text-center py-16 px-4">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#FFA048]/10 border border-[#FFA048]/20 flex items-center justify-center">
              <Bell className="w-6 h-6 text-[#FFA048]/70" />
            </div>
            <p className="text-xs text-[#C9A887] font-semibold">No notifications yet</p>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
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
              className={`rounded-2xl border px-4 py-3.5 ${
                n.isRead
                  ? 'bg-[#13110E] border-[#2D2319]/70'
                  : 'bg-[#FFA048]/08 border-[#FFA048]/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[9px] mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className="text-gray-500">{n.date || 'Today'}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-[#FFA048] font-bold uppercase tracking-wider truncate">
                    {notificationKindLabel(kind)}
                  </span>
                </div>
                <span className="uppercase tracking-wider text-gray-500 bg-black/30 px-1.5 py-0.5 rounded shrink-0">
                  {formatNotificationRole(n.receiverRole)}
                </span>
              </div>
              <h2 className="text-[12px] font-bold text-[#F4E3D7] leading-snug">{n.title}</h2>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{n.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
