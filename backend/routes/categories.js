'use strict';

const express = require('express');
const { listCategories, createCategory, deleteCategory } = require('../lib/categoryStore');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const VALID_GROUPS = new Set(['Shops', 'Services', 'Professionals', 'Food']);

// ── GET /api/categories ───────────────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const categories = await listCategories();
    res.json({ categories, total: categories.length });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/categories — admin only ─────────────────────────────────────
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, group, iconName = 'Wrench', id } = req.body;

    if (!name?.en || !group) {
      return res.status(400).json({ error: 'name.en and group are required.' });
    }
    if (!VALID_GROUPS.has(group)) {
      return res.status(400).json({ error: `group must be one of: ${[...VALID_GROUPS].join(', ')}` });
    }

    const categoryId = typeof id === 'string' && id.trim()
      ? id.trim()
      : `cat-${Date.now()}`;

    const category = await createCategory({
      id: categoryId,
      name: { en: String(name.en).trim(), ar: String(name.ar || name.en).trim() },
      group,
      iconName: String(iconName || 'Wrench'),
    });

    res.status(201).json({ category });
  } catch (err) {
    if (String(err.message).includes('duplicate') || String(err.message).includes('already exists')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

// ── DELETE /api/categories/:id — admin only ─────────────────────────────────
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const deleted = await deleteCategory(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Category not found.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
