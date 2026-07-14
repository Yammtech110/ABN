'use strict';

/** Map legacy / directory roles to notification receiver roles */
const normalizeNotificationRole = (role) => {
  if (!role) return 'customer';
  if (role === 'business_owner') return 'business';
  return role;
};

/**
 * Whether a notification belongs in this user's inbox.
 * - userId set → only that user
 * - receiverRole 'all' → everyone (broadcast)
 * - otherwise → role match (with business_owner alias)
 */
const notificationMatchesUser = (notification, user) => {
  if (!user?.id) return false;

  if (notification.userId) {
    return notification.userId === user.id;
  }

  const receiver = normalizeNotificationRole(notification.receiverRole);
  if (receiver === 'all') return true;

  const userRole = normalizeNotificationRole(user.role);
  return receiver === userRole;
};

module.exports = {
  normalizeNotificationRole,
  notificationMatchesUser,
};
