import React, { useCallback, useEffect } from 'react';
import { ArrowLeft, Bell, RefreshCw, Trash2 } from 'lucide-react';
import { useDirectory } from '../context/DirectoryContext';
import { useBackHandler } from '../context/BackNavigationContext';
import {
  classifyNotification,
  formatNotificationRole,
  isSensitiveAuthNotification,
  notificationKindColor,
  notificationKindLabel,
} from '../utils/notifications';

interface NotificationsScreenProps {
  onBack: () => void;
}

/** Full-bleed notifications inbox — charcoal theme. */
export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack }) => {
  const {
    currentUser,
    isAuthenticated,
    notifications,
    notificationsLoading,
    notificationsError,
    refreshNotifications,
    markNotificationsAsRead,
    clearNotifications,
  } = useDirectory();

  const visible = isAuthenticated
    ? notifications.filter((n) => !isSensitiveAuthNotification(n))
    : [];
  const unread = visible.filter((n) => !n.isRead).length;

  useEffect(() => {
    void refreshNotifications();
    if (isAuthenticated) void markNotificationsAsRead();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="min-h-full flex flex-col bg-[#0D0906]" id="notifications-page">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3.5 bg-[#0D0906]/95 border-b border-[#2B231D] backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full bg-[#171310] hover:bg-[#1E1915] border border-[#2B231D] transition-colors"
          aria-label="Back"
          id="notifications-page-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#F08C32]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white">
            <Bell className="w-4 h-4 text-[#F08C32]" />
            Notifications
            {unread > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#FF9E47] text-black">
                {unread}
              </span>
            )}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void refreshNotifications()}
          disabled={notificationsLoading}
          className="p-2 rounded-full bg-[#171310] border border-[#2B231D] text-[#CFCFCF] hover:text-white disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${notificationsLoading ? 'animate-spin' : ''}`} />
        </button>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={() => void handleClearAll()}
            className="p-2 rounded-full bg-[#171310] border border-[#2B231D] text-[#E84D4D] hover:bg-[#1E1915]"
            aria-label="Clear all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 bg-[#0D0906] pb-8">
        {!isAuthenticated && (
          <div className="text-center py-16 px-6">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#171310] border border-[#2B231D] flex items-center justify-center">
              <Bell className="w-6 h-6 text-[#F08C32]" />
            </div>
            <p className="text-xs font-extrabold text-white">Sign in to view notifications</p>
            <p className="text-[11px] mt-2 leading-relaxed text-[#CFCFCF]">
              Listing approvals, payments, membership alerts, and admin updates will appear here after you sign in.
            </p>
          </div>
        )}

        {isAuthenticated && notificationsError && (
          <p className="text-[11px] mx-4 mt-4 rounded-xl px-3 py-2 bg-[#E84D4D]/15 border border-[#E84D4D]/40 text-[#E84D4D]">
            {notificationsError}
          </p>
        )}

        {isAuthenticated && notificationsLoading && visible.length === 0 && (
          <p className="text-xs py-16 text-center font-semibold text-[#CFCFCF]">Loading notifications…</p>
        )}

        {isAuthenticated && !notificationsLoading && visible.length === 0 && !notificationsError && (
          <div className="text-center py-16 px-6">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#171310] border border-[#2B231D] flex items-center justify-center">
              <Bell className="w-6 h-6 text-[#F08C32]" />
            </div>
            <p className="text-xs font-extrabold text-white">No notifications yet</p>
            <p className="text-[11px] mt-2 leading-relaxed text-[#CFCFCF]">
              Listing approvals, payments, membership alerts, and admin updates will appear here.
            </p>
          </div>
        )}

        {isAuthenticated && visible.length > 0 && (
          <ul className="divide-y divide-[#2B231D]">
            {visible.map((n) => {
              const kind = classifyNotification(n);
              const dotColor = notificationKindColor(kind);
              return (
                <li
                  key={n.id}
                  className={`px-4 py-3.5 ${n.isRead ? 'bg-[#0D0906]' : 'bg-[#FF9E47]/10'}`}
                >
                  <div className="flex items-center justify-between gap-2 text-[9px] mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <span className="font-semibold text-[#CFCFCF]">{n.date || 'Today'}</span>
                      <span className="text-[#8E8E8E]">•</span>
                      <span className="font-bold uppercase tracking-wider truncate text-[#F08C32]">
                        {notificationKindLabel(kind)}
                      </span>
                    </div>
                    <span className="uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-[#1E1915] border border-[#2B231D] text-[#CFCFCF] font-bold">
                      {formatNotificationRole(n.receiverRole)}
                    </span>
                  </div>
                  <h2 className="text-[12px] font-extrabold leading-snug text-white">{n.title}</h2>
                  <p className="text-[11px] mt-1 leading-relaxed text-[#CFCFCF]">{n.message}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
