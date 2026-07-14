import React from 'react';
import { Bell, RefreshCw } from 'lucide-react';
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

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  notifications,
  loading = false,
  error = '',
  onClose,
  onRefresh,
  onClearAll,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
    <div className="relative w-full max-w-md rounded-3xl bg-[#13110E] border border-[#2D2319] p-6 text-[#F4E3D7] max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-black uppercase tracking-wider text-[#FFA048] flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {notifications.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 bg-[#FFA048]/15 text-[#FFA048] rounded-full font-bold">
              {notifications.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-[9px] px-2 py-1 text-[#FFA048] font-bold hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[9px] px-2 py-1 bg-red-950/40 text-red-400 border border-red-900/40 rounded-lg font-bold hover:bg-red-950/70 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#201B15] text-gray-400 hover:text-[#FFA048] transition-colors"
            aria-label="Close notifications"
          >
            <span className="text-sm">✕</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3 shrink-0">{error}</p>
      )}

      <div className="overflow-y-auto space-y-2.5 pr-1 scrollbar-thin flex-1 min-h-0" id="notif-modal-list">
        {loading && notifications.length === 0 && (
          <p className="text-xs text-gray-500 py-10 text-center">Loading notifications…</p>
        )}

        {!loading && notifications.length === 0 && !error && (
          <div className="text-center py-10 px-4">
            <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No notifications yet.</p>
            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
              You will see updates here for logins, listing approvals, payments, membership expiry, and admin alerts.
            </p>
          </div>
        )}

        {notifications.map((n) => {
          const kind = classifyNotification(n);
          const dotColor = notificationKindColor(kind);
          return (
            <div
              key={n.id}
              className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                n.isRead ? 'bg-[#0F0E0C] border-[#2D2319]/50' : 'bg-[#191613] border-[#FFA048]/20'
              }`}
            >
              <div className="flex items-center justify-between text-[9px] gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${!n.isRead ? 'animate-pulse' : ''}`} />
                  <span className="text-gray-500">{n.date || 'Today'}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-[#FFA048] font-bold uppercase tracking-wider truncate">
                    {notificationKindLabel(kind)}
                  </span>
                </div>
                <span className="font-bold uppercase tracking-wider text-gray-500 bg-[#2D2319]/50 px-1.5 py-0.5 rounded shrink-0">
                  {formatNotificationRole(n.receiverRole)}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{n.title}</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">{n.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
