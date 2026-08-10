'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const AppError = require('../utils/AppError');

const BCRYPT_ROUNDS = 12;
const JWT_TTL = '7d';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublicUser(user) {
  const { id, email, full_name, avatar_url, role } = user;
  return { id, email, full_name, avatar_url, role };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

function validateEmail(email) {
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 255) {
    throw new AppError('validation failed: email', 400);
  }
}

function validatePassword(password) {
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new AppError('validation failed: password', 400);
  }
}

function validateFullName(fullName) {
  if (fullName === undefined || fullName === null) return; // optional — client doesn't collect it yet
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.length > 120) {
    throw new AppError('validation failed: full_name', 400);
  }
}

async function register({ email, password, full_name }) {
  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : email;
  validateEmail(normalizedEmail);
  validatePassword(password);
  validateFullName(full_name);

  const existing = await User.findOne({ where: { email: normalizedEmail }, attributes: ['id'] });
  if (existing) {
    throw new AppError('duplicate', 409);
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    email: normalizedEmail,
    password_hash,
    full_name: full_name?.trim() || null,
    role: 'user',
  });

  return { token: signToken(user), user: toPublicUser(user) };
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError('unauthorized', 401);
  }

  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : email;
  const user = await User.findOne({
    where: { email: normalizedEmail },
    attributes: ['id', 'email', 'password_hash', 'full_name', 'avatar_url', 'role'],
  });
  if (!user || !user.password_hash) {
    throw new AppError('unauthorized', 401);
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    throw new AppError('unauthorized', 401);
  }

  return { token: signToken(user), user: toPublicUser(user) };
}

async function findUserById(id) {
  const user = await User.findByPk(id, {
    attributes: ['id', 'email', 'full_name', 'avatar_url', 'role'],
  });
  if (!user) {
    throw new AppError('unauthorized', 401);
  }
  return toPublicUser(user);
}

module.exports = { register, login, findUserById };
