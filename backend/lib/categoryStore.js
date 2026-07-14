'use strict';

const { isSupabaseStorage, directoryCategories } = require('../db');
const { DEFAULT_CATEGORIES, OTHER_CATEGORY } = require('./categorySeed');

let supabaseAdmin = null;
const getAdmin = () => {
  if (!supabaseAdmin) supabaseAdmin = require('../supabase').supabaseAdmin;
  return supabaseAdmin;
};

const mapCategoryFromDb = (row) => ({
  id:       row.id,
  name:     { en: row.name_en, ar: row.name_en },
  group:    row.cat_group,
  iconName: row.icon_name || 'Wrench',
});

const mapCategoryToDb = (cat) => ({
  id:        cat.id,
  name_en:   cat.name?.en || cat.nameEn || '',
  name_ar:   cat.name?.en || cat.nameEn || '',
  cat_group: cat.group,
  icon_name: cat.iconName || 'Wrench',
});

const isMissingCategoriesTable = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('directory_categories') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

async function listCategories() {
  if (!isSupabaseStorage()) {
    return [...directoryCategories].sort((a, b) => a.id.localeCompare(b.id));
  }

  try {
    const { data, error } = await getAdmin()
      .from('directory_categories')
      .select('*')
      .order('cat_group')
      .order('name_en');

    if (error) throw new Error(error.message);
    return (data || []).map(mapCategoryFromDb);
  } catch (err) {
    if (!isMissingCategoriesTable(err)) throw err;
    console.warn('[categories] directory_categories table missing — using in-memory store until you run 008_categories.sql');
    return [...directoryCategories].sort((a, b) => a.id.localeCompare(b.id));
  }
}

async function createCategory(input) {
  const record = {
    id:       input.id,
    name:     { en: input.name.en, ar: input.name.en },
    group:    input.group,
    iconName: input.iconName || 'Wrench',
  };

  if (!isSupabaseStorage()) {
    if (directoryCategories.some((c) => c.id === record.id)) {
      throw new Error('A category with this id already exists.');
    }
    directoryCategories.push(record);
    return record;
  }

  try {
    const { data, error } = await getAdmin()
      .from('directory_categories')
      .insert(mapCategoryToDb(record))
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapCategoryFromDb(data);
  } catch (err) {
    if (!isMissingCategoriesTable(err)) throw err;
    if (directoryCategories.some((c) => c.id === record.id)) {
      throw new Error('A category with this id already exists.');
    }
    directoryCategories.push(record);
    return record;
  }
}

async function deleteCategory(id) {
  if (!isSupabaseStorage()) {
    const idx = directoryCategories.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    directoryCategories.splice(idx, 1);
    return true;
  }

  try {
    const { error } = await getAdmin()
      .from('directory_categories')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    const idx = directoryCategories.findIndex((c) => c.id === id);
    if (idx >= 0) directoryCategories.splice(idx, 1);
    return true;
  } catch (err) {
    if (!isMissingCategoriesTable(err)) throw err;
    const idx = directoryCategories.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    directoryCategories.splice(idx, 1);
    return true;
  }
}

async function ensureOtherCategory() {
  if (!OTHER_CATEGORY) return false;
  const existing = await listCategories();
  if (existing.some((c) => c.id === OTHER_CATEGORY.id)) return false;

  const mapped = {
    id:       OTHER_CATEGORY.id,
    name:     { en: OTHER_CATEGORY.nameEn, ar: OTHER_CATEGORY.nameAr },
    group:    OTHER_CATEGORY.group,
    iconName: OTHER_CATEGORY.iconName,
  };

  if (!isSupabaseStorage()) {
    directoryCategories.push(mapped);
    return true;
  }

  try {
    const { error } = await getAdmin()
      .from('directory_categories')
      .insert(mapCategoryToDb(mapped));
    if (error && !String(error.message).includes('duplicate')) {
      if (isMissingCategoriesTable(error)) {
        directoryCategories.push(mapped);
        return true;
      }
      throw new Error(error.message);
    }
    return true;
  } catch (err) {
    if (isMissingCategoriesTable(err)) {
      directoryCategories.push(mapped);
      return true;
    }
    throw err;
  }
}

async function seedDefaultCategories() {
  const existing = await listCategories();
  if (existing.length > 0) {
    if (!isSupabaseStorage()) {
      directoryCategories.splice(0, directoryCategories.length, ...existing);
    }
    await ensureOtherCategory();
    return existing.length;
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const mapped = {
      id:       cat.id,
      name:     { en: cat.nameEn, ar: cat.nameAr },
      group:    cat.group,
      iconName: cat.iconName,
    };
    if (!isSupabaseStorage()) {
      directoryCategories.push(mapped);
    } else {
      try {
        const { error } = await getAdmin()
          .from('directory_categories')
          .insert(mapCategoryToDb(mapped));
        if (error && !String(error.message).includes('duplicate')) {
          if (isMissingCategoriesTable(error)) {
            directoryCategories.push(mapped);
            continue;
          }
          throw new Error(error.message);
        }
      } catch (err) {
        if (isMissingCategoriesTable(err)) {
          directoryCategories.push(mapped);
          continue;
        }
        throw err;
      }
    }
  }

  const mode = isSupabaseStorage() ? 'Supabase directory_categories' : 'in-memory';
  console.log(`[db] Categories ready (${mode}) — ${DEFAULT_CATEGORIES.length} seeded`);
  return DEFAULT_CATEGORIES.length;
}

module.exports = {
  listCategories,
  createCategory,
  deleteCategory,
  seedDefaultCategories,
  ensureOtherCategory,
};
