'use strict';

const { isSupabaseStorage } = require('../config/storage');

let supabaseAdmin = null;
const getAdmin = () => {
  if (!supabaseAdmin) supabaseAdmin = require('../supabase').supabaseAdmin;
  return supabaseAdmin;
};

/** blockerId -> Set(blockedUserId) */
const memoryBlocks = new Map();

function memoryList(blockerId) {
  return [...(memoryBlocks.get(blockerId) || [])];
}

async function listBlockedUserIds(blockerId) {
  if (!isSupabaseStorage()) return memoryList(blockerId);

  try {
    const { data, error } = await getAdmin()
      .from('user_blocks')
      .select('blocked_user_id')
      .eq('blocker_id', blockerId);
    if (error) throw new Error(error.message);
    return (data || []).map((r) => r.blocked_user_id);
  } catch (err) {
    console.warn('[blocks] falling back to memory:', err.message);
    return memoryList(blockerId);
  }
}

async function blockUser(blockerId, blockedUserId) {
  if (blockerId === blockedUserId) {
    const err = new Error('You cannot block yourself.');
    err.status = 400;
    throw err;
  }

  if (!isSupabaseStorage()) {
    if (!memoryBlocks.has(blockerId)) memoryBlocks.set(blockerId, new Set());
    memoryBlocks.get(blockerId).add(blockedUserId);
    return memoryList(blockerId);
  }

  try {
    const { error } = await getAdmin()
      .from('user_blocks')
      .upsert(
        { blocker_id: blockerId, blocked_user_id: blockedUserId },
        { onConflict: 'blocker_id,blocked_user_id' },
      );
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn('[blocks] upsert failed, using memory:', err.message);
    if (!memoryBlocks.has(blockerId)) memoryBlocks.set(blockerId, new Set());
    memoryBlocks.get(blockerId).add(blockedUserId);
  }
  return listBlockedUserIds(blockerId);
}

async function unblockUser(blockerId, blockedUserId) {
  if (!isSupabaseStorage()) {
    memoryBlocks.get(blockerId)?.delete(blockedUserId);
    return memoryList(blockerId);
  }

  try {
    await getAdmin()
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_user_id', blockedUserId);
  } catch (err) {
    console.warn('[blocks] delete failed:', err.message);
    memoryBlocks.get(blockerId)?.delete(blockedUserId);
  }
  return listBlockedUserIds(blockerId);
}

module.exports = { listBlockedUserIds, blockUser, unblockUser };
