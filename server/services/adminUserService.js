'use strict';

// Admin user management (docs/API.md § Admin, /api/admin/users). Like
// categoryService.js, these take no acting-user scope on list() — the
// catalog is global — but setDisabled needs the acting admin's id to block
// self-disable.

const { User } = require('../models');
const AppError = require('../utils/AppError');

// Never password_hash or google_refresh_token — docs/SECURITY.md § Secrets.
const PUBLIC_ATTRIBUTES = ['id', 'email', 'full_name', 'avatar_url', 'role', 'disabled', 'created_at'];

async function list() {
  const users = await User.findAll({
    attributes: PUBLIC_ATTRIBUTES,
    order: [['id', 'ASC']],
  });
  return users.map((u) => u.get({ plain: true }));
}

async function findById(id) {
  const user = await User.findOne({ where: { id }, attributes: PUBLIC_ATTRIBUTES });
  if (!user) throw new AppError('not found', 404);
  return user;
}

async function setDisabled(actingAdminId, id, disabled) {
  const user = await findById(id);

  // The last admin must never be able to lock themselves out of the panel.
  if (disabled && user.id === actingAdminId) {
    throw new AppError('cannot disable your own account', 400);
  }

  await user.update({ disabled });
  return { id: user.id, disabled: user.disabled };
}

module.exports = { list, setDisabled };
