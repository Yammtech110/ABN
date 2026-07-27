'use strict';

const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, newId, today } = require('../db');

const memoryLogs = [];

const isMissingTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('admin_activity_log') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

const mapFromDb = (row) => ({
  id: row.id,
  adminId: row.admin_id || '',
  adminEmail: row.admin_email || '',
  adminName: row.admin_name || '',
  action: row.action || '',
  targetType: row.target_type || 'listing',
  targetId: row.target_id || '',
  targetName: row.target_name || '',
  details: row.details || '',
  date: row.created_at ? String(row.created_at).slice(0, 10) : today(),
  createdAt: row.created_at || null,
});

async function logAdminAction({
  admin,
  action,
  targetType = 'listing',
  targetId = '',
  targetName = '',
  details = '',
}) {
  const record = {
    id: newId('aal'),
    adminId: admin?.id || '',
    adminEmail: admin?.email || '',
    adminName: admin?.name || admin?.email?.split('@')[0] || 'Admin',
    action: String(action || 'unknown'),
    targetType,
    targetId: String(targetId || ''),
    targetName: String(targetName || ''),
    details: String(details || '').slice(0, 2000),
    date: today(),
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseStorage()) {
    memoryLogs.unshift(record);
    return record;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('admin_activity_log')
      .insert({
        admin_id: record.adminId,
        admin_email: record.adminEmail,
        admin_name: record.adminName,
        action: record.action,
        target_type: record.targetType,
        target_id: record.targetId,
        target_name: record.targetName,
        details: record.details,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  } catch (err) {
    if (isMissingTable(err)) {
      memoryLogs.unshift(record);
      return record;
    }
    console.warn('[activityLog] failed:', err.message);
    return record;
  }
}

async function listAdminActivity({ limit = 100 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 500);
  if (!isSupabaseStorage()) {
    return memoryLogs.slice(0, capped);
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(capped);
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  } catch (err) {
    if (isMissingTable(err)) return memoryLogs.slice(0, capped);
    throw err;
  }
}

module.exports = { logAdminAction, listAdminActivity };
