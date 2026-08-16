'use strict';

// Admin global category catalog (docs/API.md § Admin, /api/admin/categories).
// Not the client's "Category" concept (client/src/services/categoryService.js,
// which is the renamed `envelopes` service) — see docs/PLAN.md ticket A-06/B-06
// for the naming-collision note. Unlike every other service in this codebase,
// these functions take no `userId` — the catalog is global, not owner-scoped.

const { Category } = require('../models');
const AppError = require('../utils/AppError');

const PUBLIC_ATTRIBUTES = ['id', 'name_he', 'name_en', 'color', 'is_active', 'created_at'];

/** Pre-check rather than catching UniqueConstraintError — same pattern as authService.register. */
async function assertNameAvailable(name_en, excludeId) {
  const where = { name_en };
  const existing = await Category.findOne({ where, attributes: ['id'] });
  if (existing && existing.id !== excludeId) {
    throw new AppError('duplicate', 409);
  }
}

/** Full catalog, including inactive rows — the admin panel needs to see and un-retire them. */
async function list() {
  const categories = await Category.findAll({
    attributes: PUBLIC_ATTRIBUTES,
    order: [['name_he', 'ASC'], ['id', 'ASC']],
  });
  return categories.map((c) => c.get({ plain: true }));
}

async function create({ name_he, name_en, color, is_active }) {
  await assertNameAvailable(name_en);
  const category = await Category.create({
    name_he,
    name_en,
    color,
    is_active: is_active === undefined ? true : is_active,
  });
  return category.get({ plain: true });
}

async function findById(id) {
  const category = await Category.findOne({ where: { id }, attributes: PUBLIC_ATTRIBUTES });
  if (!category) throw new AppError('not found', 404);
  return category;
}

async function update(id, patch) {
  const category = await findById(id);
  const { name_he, name_en, color, is_active } = patch;

  if (name_en !== undefined && name_en !== category.name_en) {
    await assertNameAvailable(name_en, category.id);
  }

  const fields = {};
  if (name_he !== undefined) fields.name_he = name_he;
  if (name_en !== undefined) fields.name_en = name_en;
  if (color !== undefined) fields.color = color;
  if (is_active !== undefined) fields.is_active = is_active;

  await category.update(fields);
  return category.get({ plain: true });
}

async function remove(id) {
  const category = await findById(id);
  await category.destroy();
  return { id: category.id };
}

module.exports = { list, create, update, remove, findById };
