/**
 * db.js — Storage helpers + in-memory fallback caches
 */

'use strict';

const { isSupabaseStorage } = require('./config/storage');
const { users, stableId, newId, today } = require('./lib/memoryStore');

const reviews = [];
const directoryProfiles = [];
const jobsBoard = [];

module.exports = {
  users,
  reviews,
  directoryProfiles,
  jobsBoard,
  stableId,
  newId,
  today,
  isSupabaseStorage,
};
