'use strict';

const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, newId, today } = require('../db');

/** In-memory fallback when Supabase table is missing or STORAGE_MODE=memory */
const memoryRequests = [];

const isMissingTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('listing_change_requests') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

const mapFromDb = (row) => ({
  id: row.id,
  businessId: row.business_id,
  ownerEmail: row.owner_email || '',
  currentName: row.current_name || '',
  proposedName: row.proposed_name ?? null,
  proposedImageUrl: row.proposed_image_url ?? null,
  proposedCoverUrl: row.proposed_cover_url ?? null,
  note: row.note || '',
  status: row.status || 'pending',
  adminNotes: row.admin_notes || '',
  date: row.created_at ? String(row.created_at).slice(0, 10) : today(),
  createdAt: row.created_at || null,
  resolvedAt: row.resolved_at || null,
});

const mapToDb = (req) => ({
  id: req.id,
  business_id: req.businessId,
  owner_email: req.ownerEmail || '',
  current_name: req.currentName || '',
  proposed_name: req.proposedName ?? null,
  proposed_image_url: req.proposedImageUrl ?? null,
  proposed_cover_url: req.proposedCoverUrl ?? null,
  note: req.note || '',
  status: req.status || 'pending',
  admin_notes: req.adminNotes || '',
  created_at: req.createdAt || new Date().toISOString(),
  resolved_at: req.resolvedAt || null,
});

async function listChangeRequests({ status } = {}) {
  if (!isSupabaseStorage()) {
    let rows = [...memoryRequests];
    if (status) rows = rows.filter((r) => r.status === status);
    return rows.sort(
      (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime(),
    );
  }

  try {
    let q = supabaseAdmin
      .from('listing_change_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn('[changeRequests] table missing — using memory until 014_listing_change_requests.sql is applied');
      let rows = [...memoryRequests];
      if (status) rows = rows.filter((r) => r.status === status);
      return rows;
    }
    throw err;
  }
}

async function findPendingForBusiness(businessId) {
  const all = await listChangeRequests({ status: 'pending' });
  return all.find((r) => r.businessId === businessId) || null;
}

async function findById(id) {
  if (!isSupabaseStorage()) {
    return memoryRequests.find((r) => r.id === id) || null;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('listing_change_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapFromDb(data) : null;
  } catch (err) {
    if (isMissingTable(err)) {
      return memoryRequests.find((r) => r.id === id) || null;
    }
    throw err;
  }
}

async function createChangeRequest(payload) {
  const record = {
    id: newId('lcr'),
    businessId: payload.businessId,
    ownerEmail: payload.ownerEmail || '',
    currentName: payload.currentName || '',
    proposedName: payload.proposedName ?? null,
    proposedImageUrl: payload.proposedImageUrl ?? null,
    proposedCoverUrl: payload.proposedCoverUrl ?? null,
    note: payload.note || '',
    status: 'pending',
    adminNotes: '',
    date: today(),
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  if (!isSupabaseStorage()) {
    memoryRequests.unshift(record);
    return record;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('listing_change_requests')
      .insert(mapToDb(record))
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  } catch (err) {
    if (isMissingTable(err)) {
      memoryRequests.unshift(record);
      return record;
    }
    throw err;
  }
}

async function updateChangeRequest(id, patch) {
  const existing = await findById(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };

  if (!isSupabaseStorage()) {
    const idx = memoryRequests.findIndex((r) => r.id === id);
    if (idx >= 0) memoryRequests[idx] = updated;
    else memoryRequests.unshift(updated);
    return updated;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('listing_change_requests')
      .update({
        status: updated.status,
        admin_notes: updated.adminNotes || '',
        resolved_at: updated.resolvedAt || null,
        proposed_name: updated.proposedName,
        proposed_image_url: updated.proposedImageUrl,
        proposed_cover_url: updated.proposedCoverUrl,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  } catch (err) {
    if (isMissingTable(err)) {
      const idx = memoryRequests.findIndex((r) => r.id === id);
      if (idx >= 0) memoryRequests[idx] = updated;
      else memoryRequests.unshift(updated);
      return updated;
    }
    throw err;
  }
}

module.exports = {
  listChangeRequests,
  findPendingForBusiness,
  findById,
  createChangeRequest,
  updateChangeRequest,
};
