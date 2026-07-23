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
    <div className="page-shell min-h-full flex flex-col" id="notifications-page">
      <div className="page-header sticky top-0 z-10 flex items-center gap-2 px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="page-back-btn p-2 rounded-full transition-colors"
          aria-label="Back"
          id="notifications-page-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="page-title text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Bell className="page-title-icon w-4 h-4" />
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

      <div className="page-body flex-1 px-4 py-4 space-y-3 pb-8">
        {notificationsError && (
          <p className="page-error text-[11px] rounded-xl px-3 py-2">{notificationsError}</p>
        )}

        {notificationsLoading && visible.length === 0 && (
          <p className="page-meta text-xs py-16 text-center">Loading notifications…</p>
        )}

        {!notificationsLoading && visible.length === 0 && !notificationsError && (
          <div className="text-center py-16 px-4">
            <div className="page-empty-icon mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-[#FFA048]/70" />
            </div>
            <p className="page-card-title text-xs font-semibold">No notifications yet</p>
            <p className="page-meta text-[10px] mt-2 leading-relaxed">
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
              className={`page-card rounded-2xl px-4 py-3.5 ${
                n.isRead ? 'page-card-read' : 'page-card-unread'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[9px] mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className="page-meta">{n.date || 'Today'}</span>
                  <span className="page-meta">•</span>
                  <span className="page-title-icon font-bold uppercase tracking-wider truncate">
                    {notificationKindLabel(kind)}
                  </span>
                </div>
                <span className="page-chip uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0">
                  {formatNotificationRole(n.receiverRole)}
                </span>
              </div>
              <h2 className="page-card-title text-[12px] font-bold leading-snug">{n.title}</h2>
              <p className="page-card-body text-[11px] mt-1 leading-relaxed">{n.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
