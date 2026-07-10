'use strict';

const { supabaseAdmin } = require('../supabase');
const { isSupabaseStorage, directoryProfiles } = require('../db');
const { mapProfileFromDb } = require('./supabaseMappers');

/** Roles that may own a row in profiles_directory */
const DIRECTORY_OWNER_ROLES = new Set(['business', 'service_provider']);

const userOwnsDirectoryProfile = (role) => DIRECTORY_OWNER_ROLES.has(role);

async function findProfileByEmail(email) {
  if (!isSupabaseStorage()) {
    return directoryProfiles.find((p) => p.email === email) || null;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles_directory')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProfileFromDb(data) : null;
}

/** Returns null for customers/admins without querying the directory table. */
async function findProfileForUser(user) {
  if (!user || !userOwnsDirectoryProfile(user.role)) return null;
  return findProfileByEmail(user.email);
}

module.exports = {
  DIRECTORY_OWNER_ROLES,
  userOwnsDirectoryProfile,
  findProfileByEmail,
  findProfileForUser,
};
