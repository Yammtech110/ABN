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

const DEMO_ACCOUNTS = [
  {
    email:    'admin@shiadirectory.com',
    password: 'admin123',
    role:     'admin',
    name:     'Abu Murtadha (Admin)',
    phone:    '+1 780 000 0000',
  },
];

const HASH_ROUNDS = 10;

async function findByEmail(email) {
  const key = email.toLowerCase().trim();
  if (!isSupabaseStorage()) return users.get(key) || null;

  const { data, error } = await getAdmin()
    .from('app_users')
    .select('*')
    .eq('email', key)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUserFromDb(data) : null;
}

async function findById(id) {
  if (!isSupabaseStorage()) {
    return [...users.values()].find((u) => u.id === id) || null;
  }

  const { data, error } = await getAdmin()
    .from('app_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUserFromDb(data) : null;
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

async function seedDemoAccounts() {
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
    };
    await createUser(record);
  }

  const mode = isSupabaseStorage() ? 'Supabase app_users' : 'in-memory';
  console.log(`[db] Auth ready (${mode}) — ${users.size} accounts loaded`);
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateUser,
  seedDemoAccounts,
};
