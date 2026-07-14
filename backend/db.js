/**
 * db.js — Storage helpers + in-memory fallback caches
 */

'use strict';

const { isSupabaseStorage } = require('./config/storage');
const { users, stableId, newId, newUuid, today } = require('./lib/memoryStore');

const reviews = [];
const directoryProfiles = [];
const jobsBoard = [];
const listingReports = [];
const directoryCategories = [];
const appNotifications = [];

module.exports = {
  users,
  reviews,
  directoryProfiles,
  jobsBoard,
  listingReports,
  directoryCategories,
  appNotifications,
  stableId,
  newId,
  newUuid,
  today,
  isSupabaseStorage,
};
