'use strict';

const users = new Map();

const stableId = (role, email) =>
  `${role}-${email.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

const newId = (prefix = '') =>
  `${prefix}${prefix ? '-' : ''}${Date.now()}${Math.floor(Math.random() * 1000)}`;

const today = () => new Date().toISOString().split('T')[0];

module.exports = { users, stableId, newId, today };
