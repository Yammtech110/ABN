'use strict';

const bcrypt = require('bcryptjs');
const { users, stableId } = require('./memoryStore');
const { isSupabaseStorage } = require('../config/storage');
const { mapUserFromDb, mapUserToDb } = require('./supabaseMappers');

let supabaseAdmin = null;
const getAdmin = () => {
  if (!supabaseAdmin) supabaseAdmin = require('../supabase').supabaseAdmin;
  return supabaseAdmin;
};

const DEFAULT_ADMIN_PASSWORD = 'admin123';

const DEMO_ACCOUNTS = [
  {
    email:    process.env.ADMIN_EMAIL || 'admin@shiadirectory.com',
    password: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    role:     'admin',
    name:     'Abu Murtadha (Admin)',
    phone:    '+1 780 000 0000',
  },
];

const HASH_ROUNDS = 10;

/** In-memory blocked state when app_users.is_blocked column is not migrated yet */
const memoryBlockedById = new Map();

const isMissingBlockedColumn = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('is_blocked') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
};

const applyBlockedState = (user) => {
  if (!user) return user;
  if (memoryBlockedById.has(user.id)) {
    return { ...user, isBlocked: memoryBlockedById.get(user.id) };
  }
  return user;
};

async function findByEmail(email) {
  const key = email.toLowerCase().trim();
  if (!isSupabaseStorage()) {
    return applyBlockedState(users.get(key) || null);
  }

  const { data, error } = await getAdmin()
    .from('app_users')
    .select('*')
    .eq('email', key)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? applyBlockedState(mapUserFromDb(data)) : null;
}

async function findById(id) {
  if (!isSupabaseStorage()) {
    return applyBlockedState([...users.values()].find((u) => u.id === id) || null);
  }

  const { data, error } = await getAdmin()
    .from('app_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? applyBlockedState(mapUserFromDb(data)) : null;
}

async function createUser(record) {
  if (!isSupabaseStorage()) {
    users.set(record.email, record);
    return record;
  }

  const { data, error } = await getAdmin()
    .from('app_users')
    .insert(mapUserToDb(record))
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const mapped = mapUserFromDb(data);
  users.set(mapped.email, mapped);
  return mapped;
}

async function updateUser(id, updates) {
  const existing = await findById(id);
  if (!existing) return null;

  const merged = { ...existing, ...updates };

  if (!isSupabaseStorage()) {
    users.set(merged.email, merged);
    return merged;
  }

  const patch = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.preferredLanguage !== undefined) patch.preferred_language = updates.preferredLanguage;
  if (updates.emailVerified !== undefined) patch.email_verified = Boolean(updates.emailVerified);
  if (updates.passwordHash !== undefined) patch.password_hash = updates.passwordHash;

  const { data, error } = await getAdmin()
    .from('app_users')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const mapped = mapUserFromDb(data);
  users.set(mapped.email, mapped);
  return mapped;
}

async function listAllUsers() {
  if (!isSupabaseStorage()) {
    return [...users.values()]
      .map((user) => applyBlockedState(user))
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  const { data, error } = await getAdmin()
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((row) => applyBlockedState(mapUserFromDb(row)));
}

async function setUserBlocked(id, isBlocked) {
  const existing = await findById(id);
  if (!existing) return null;

  const merged = { ...existing, isBlocked: Boolean(isBlocked) };

  if (!isSupabaseStorage()) {
    users.set(merged.email, merged);
    memoryBlockedById.set(id, Boolean(isBlocked));
    return merged;
  }

  try {
    const { data, error } = await getAdmin()
      .from('app_users')
      .update({ is_blocked: Boolean(isBlocked) })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const mapped = applyBlockedState(mapUserFromDb(data));
    users.set(mapped.email, mapped);
    return mapped;
  } catch (err) {
    if (!isMissingBlockedColumn(err)) throw err;
    console.warn('[users] app_users.is_blocked column missing — using in-memory block list until you run 006_user_blocked.sql');
    memoryBlockedById.set(id, Boolean(isBlocked));
    users.set(merged.email, merged);
    return merged;
  }
}

async function seedDemoAccounts() {
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD) === DEFAULT_ADMIN_PASSWORD
  ) {
    console.warn('[security] Admin account is using the default password. Set ADMIN_PASSWORD (and ADMIN_EMAIL) to a strong secret in production.');
  }

  for (const d of DEMO_ACCOUNTS) {
    const key = d.email.toLowerCase();
    const existing = await findByEmail(key);
    if (existing) {
      users.set(key, existing);
      continue;
    }

    const passwordHash = await bcrypt.hash(d.password, HASH_ROUNDS);
    const record = {
      id:                stableId(d.role, key),
      email:             key,
      phone:             d.phone,
      name:              d.name,
      role:              d.role,
      passwordHash,
      preferredLanguage: 'en',
      emailVerified:     true,
    };
    await createUser(record);
  }

  const mode = isSupabaseStorage() ? 'Supabase app_users' : 'in-memory';
  console.log(`[db] Auth ready (${mode}) — ${users.size} accounts loaded`);
}

async function deleteUser(id) {
  const existing = await findById(id);
  if (!existing) return false;

  if (!isSupabaseStorage()) {
    users.delete(existing.email);
    memoryBlockedById.delete(id);
    return true;
  }

  const { error } = await getAdmin().from('app_users').delete().eq('id', id);
  if (error) throw new Error(error.message);
  users.delete(existing.email);
  memoryBlockedById.delete(id);
  return true;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateUser,
  deleteUser,
  listAllUsers,
  setUserBlocked,
  seedDemoAccounts,
};
