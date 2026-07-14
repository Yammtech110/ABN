'use strict';

const crypto = require('crypto');

const users = new Map();

const stableId = (role, email) =>
  `${role}-${email.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

const newId = (prefix = '') =>
  `${prefix}${prefix ? '-' : ''}${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** UUID v4 for Supabase tables with uuid primary keys */
const newUuid = () => crypto.randomUUID();

const today = () => new Date().toISOString().split('T')[0];

module.exports = { users, stableId, newId, newUuid, today };
