'use strict';

const { isSupabaseStorage } = require('../db');

let supabaseAdmin = null;
const getAdmin = () => {
  if (!supabaseAdmin) supabaseAdmin = require('../supabase').supabaseAdmin;
  return supabaseAdmin;
};

/** In-memory fallback when Supabase table is missing or STORAGE_MODE=memory */
const memoryTokens = [];

const mapRow = (row) => ({
  id:        String(row.id),
  userId:    String(row.user_id),
  userRole:  row.user_role || 'customer',
  token:     row.token,
  platform:  row.platform || 'android',
  updatedAt: row.updated_at || null,
});

const isMissingTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('device_tokens') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

async function upsertDeviceToken({ userId, userRole, token, platform = 'android' }) {
  if (!userId || !token) throw new Error('userId and token are required.');

  const record = {
    id:        `tok-${Date.now()}`,
    userId:    String(userId),
    userRole:  userRole || 'customer',
    token:     String(token).trim(),
    platform:  platform || 'android',
    updatedAt: new Date().toISOString(),
  };

  if (!isSupabaseStorage()) {
    const idx = memoryTokens.findIndex((t) => t.token === record.token);
    if (idx >= 0) memoryTokens[idx] = { ...memoryTokens[idx], ...record };
    else memoryTokens.push(record);
    return record;
  }

  try {
    const { data, error } = await getAdmin()
      .from('device_tokens')
      .upsert(
        {
          user_id:    record.userId,
          user_role:  record.userRole,
          token:      record.token,
          platform:   record.platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      )
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const idx = memoryTokens.findIndex((t) => t.token === record.token);
    if (idx >= 0) memoryTokens[idx] = { ...memoryTokens[idx], ...record };
    else memoryTokens.push(record);
    return record;
  }
}

async function removeDeviceToken(token) {
  if (!token) return;

  if (!isSupabaseStorage()) {
    const idx = memoryTokens.findIndex((t) => t.token === token);
    if (idx >= 0) memoryTokens.splice(idx, 1);
    return;
  }

  try {
    const { error } = await getAdmin()
      .from('device_tokens')
      .delete()
      .eq('token', token);
    if (error) throw new Error(error.message);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    const idx = memoryTokens.findIndex((t) => t.token === token);
    if (idx >= 0) memoryTokens.splice(idx, 1);
  }
}

async function removeTokensForUser(userId) {
  if (!userId) return;

  if (!isSupabaseStorage()) {
    for (let i = memoryTokens.length - 1; i >= 0; i -= 1) {
      if (memoryTokens[i].userId === String(userId)) memoryTokens.splice(i, 1);
    }
    return;
  }

  try {
    await getAdmin().from('device_tokens').delete().eq('user_id', String(userId));
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    for (let i = memoryTokens.length - 1; i >= 0; i -= 1) {
      if (memoryTokens[i].userId === String(userId)) memoryTokens.splice(i, 1);
    }
  }
}

async function listTokensForNotification({ userId = null, receiverRole = 'all' }) {
  const all = await listAllTokens();
  return all.filter((t) => {
    if (userId && t.userId === String(userId)) return true;
    if (userId) return false;
    if (receiverRole === 'all') return true;
    return t.userRole === receiverRole;
  });
}

async function listAllTokens() {
  if (!isSupabaseStorage()) return [...memoryTokens];

  try {
    const { data, error } = await getAdmin()
      .from('device_tokens')
      .select('*');
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    return [...memoryTokens];
  }
}

module.exports = {
  upsertDeviceToken,
  removeDeviceToken,
  removeTokensForUser,
  listTokensForNotification,
};
