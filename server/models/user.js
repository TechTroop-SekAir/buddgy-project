'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      password_hash: { type: DataTypes.STRING(255) },
      full_name: { type: DataTypes.STRING(120) },
      avatar_url: { type: DataTypes.TEXT },
      // Encrypted at rest — see docs/SECURITY.md
      google_refresh_token: { type: DataTypes.TEXT },
      role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'user' },
      disabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // Null until PATCH /api/auth/onboarding — see docs/API.md § Auth.
      onboarding_completed_at: { type: DataTypes.DATE },
    },
    {
      tableName: 'users',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return User;
};
