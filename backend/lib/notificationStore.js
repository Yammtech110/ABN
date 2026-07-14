'use strict';

const { isSupabaseStorage, appNotifications } = require('../db');
const { notificationMatchesUser } = require('./notificationRoles');

let supabaseAdmin = null;
const getAdmin = () => {
  if (!supabaseAdmin) supabaseAdmin = require('../supabase').supabaseAdmin;
  return supabaseAdmin;
};

const mapNotificationFromDb = (row) => ({
  id:           String(row.id),
  userId:       row.user_id || null,
  receiverRole: row.receiver_role || 'all',
  title:        row.title,
  message:      row.message,
  isRead:       Boolean(row.is_read),
  date:         row.created_at ? String(row.created_at).slice(0, 10) : '',
  createdAt:    row.created_at || null,
});

const isMissingNotificationsTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('app_notifications') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

async function createNotification({ userId = null, receiverRole = 'all', title, message }) {
  const record = {
    id:           `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    receiverRole,
    title,
    message,
    isRead:       false,
    date:         new Date().toISOString().slice(0, 10),
    createdAt:    new Date().toISOString(),
  };

  if (!isSupabaseStorage()) {
    appNotifications.unshift(record);
    return record;
  }

  try {
    const { data, error } = await getAdmin()
      .from('app_notifications')
      .insert({
        user_id:       userId,
        receiver_role: receiverRole,
        title,
        message,
        is_read:       false,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapNotificationFromDb(data);
  } catch (err) {
    if (!isMissingNotificationsTable(err)) throw err;
    appNotifications.unshift(record);
    return record;
  }
}

async function listNotificationsForUser(user) {
  if (!isSupabaseStorage()) {
    return appNotifications
      .filter((n) => notificationMatchesUser(n, user))
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }

  try {
    const { data, error } = await getAdmin()
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || [])
      .map(mapNotificationFromDb)
      .filter((n) => notificationMatchesUser(n, user));
  } catch (err) {
    if (!isMissingNotificationsTable(err)) throw err;
    return appNotifications
      .filter((n) => notificationMatchesUser(n, user))
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }
}

async function markAllReadForUser(user) {
  const markOne = (n) => {
    if (notificationMatchesUser(n, user)) n.isRead = true;
  };

  if (!isSupabaseStorage()) {
    appNotifications.forEach(markOne);
    return;
  }

  try {
    const { data, error } = await getAdmin()
      .from('app_notifications')
      .select('id, user_id, receiver_role, is_read');

    if (error) throw new Error(error.message);

    const ids = (data || [])
      .map(mapNotificationFromDb)
      .filter((n) => notificationMatchesUser(n, user) && !n.isRead)
      .map((n) => n.id);

    if (ids.length === 0) return;

    await getAdmin()
      .from('app_notifications')
      .update({ is_read: true })
      .in('id', ids);
  } catch (err) {
    if (!isMissingNotificationsTable(err)) throw err;
    appNotifications.forEach(markOne);
  }
}

async function clearNotificationsForUser(user) {
  if (!isSupabaseStorage()) {
    for (let i = appNotifications.length - 1; i >= 0; i -= 1) {
      if (notificationMatchesUser(appNotifications[i], user)) {
        appNotifications.splice(i, 1);
      }
    }
    return;
  }

  try {
    const { data, error } = await getAdmin()
      .from('app_notifications')
      .select('id, user_id, receiver_role');

    if (error) throw new Error(error.message);

    const ids = (data || [])
      .map(mapNotificationFromDb)
      .filter((n) => notificationMatchesUser(n, user))
      .map((n) => n.id);

    if (ids.length === 0) return;

    await getAdmin()
      .from('app_notifications')
      .delete()
      .in('id', ids);
  } catch (err) {
    if (!isMissingNotificationsTable(err)) throw err;
    for (let i = appNotifications.length - 1; i >= 0; i -= 1) {
      if (notificationMatchesUser(appNotifications[i], user)) {
        appNotifications.splice(i, 1);
      }
    }
  }
}

module.exports = {
  createNotification,
  listNotificationsForUser,
  markAllReadForUser,
  clearNotificationsForUser,
};
