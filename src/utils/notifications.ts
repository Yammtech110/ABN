import { AppNotification, UserProfile } from '../types';

export type NotificationKind =
  | 'login'
  | 'welcome'
  | 'vetting'
  | 'approval'
  | 'payment'
  | 'expiry'
  | 'report'
  | 'platform'
  | 'general';

const normalizeRole = (role: string) => (role === 'business_owner' ? 'business' : role);

/** Match server-side inbox rules on the client (API already filters; used for badges). */
export const notificationMatchesUser = (
  notification: AppNotification,
  user: UserProfile | null | undefined,
): boolean => {
  if (!user) return false;
  if (notification.userId) return notification.userId === user.id;
  const receiver = normalizeRole(notification.receiverRole);
  if (receiver === 'all') return true;
  return receiver === normalizeRole(user.role);
};

export const filterNotificationsForUser = (
  notifications: AppNotification[],
  user: UserProfile | null | undefined,
): AppNotification[] =>
  notifications.filter((n) => notificationMatchesUser(n, user));

export const countUnreadNotifications = (
  notifications: AppNotification[],
  user: UserProfile | null | undefined,
): number =>
  filterNotificationsForUser(notifications, user).filter((n) => !n.isRead).length;

export const classifyNotification = (notification: AppNotification): NotificationKind => {
  const hay = `${notification.title} ${notification.message}`.toLowerCase();
  if (hay.includes('login') || hay.includes('welcome back')) return 'login';
  if (hay.includes('welcome') || hay.includes('account was created')) return 'welcome';
  if (hay.includes('vetting') || hay.includes('submission') || hay.includes('awaiting admin')) return 'vetting';
  if (hay.includes('approved') || hay.includes('rejected') || hay.includes('suspended')) return 'approval';
  if (hay.includes('renew') || hay.includes('payment') || hay.includes('subscription') || hay.includes('invoice')) return 'payment';
  if (hay.includes('expir') || hay.includes('trial')) return 'expiry';
  if (hay.includes('report') || hay.includes('integrity') || hay.includes('flagged')) return 'report';
  if (notification.receiverRole === 'all') return 'platform';
  return 'general';
};

export const notificationKindLabel = (kind: NotificationKind): string => {
  switch (kind) {
    case 'login': return 'Sign-in';
    case 'welcome': return 'Welcome';
    case 'vetting': return 'Vetting';
    case 'approval': return 'Listing';
    case 'payment': return 'Billing';
    case 'expiry': return 'Membership';
    case 'report': return 'Report';
    case 'platform': return 'Platform';
    default: return 'Update';
  }
};

export const notificationKindColor = (kind: NotificationKind): string => {
  switch (kind) {
    case 'vetting': return 'bg-amber-500';
    case 'approval': return 'bg-green-500';
    case 'payment': return 'bg-[#FFA048]';
    case 'expiry': return 'bg-red-500';
    case 'report': return 'bg-orange-500';
    case 'login':
    case 'welcome': return 'bg-blue-500';
    default: return 'bg-[#FFA048]';
  }
};

export const formatNotificationRole = (role: AppNotification['receiverRole']): string => {
  if (role === 'all') return 'Everyone';
  if (role === 'admin') return 'Admin';
  if (role === 'service_provider') return 'Service';
  if (role === 'business') return 'Business';
  return 'Member';
};
