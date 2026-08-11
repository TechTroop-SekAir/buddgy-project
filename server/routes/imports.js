'use strict';

const { Router } = require('express');
const multer = require('multer');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const importsController = require('../controllers/importsController');
const AppError = require('../utils/AppError');
const { MAX_CSV_FILE_SIZE_BYTES } = require('../services/storageService');

// Memory storage — the buffer never touches disk before being validated and
// forwarded to storageService; multer's own limit is a first line of defense
// ahead of storageService.validateCsvFile's checks.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CSV_FILE_SIZE_BYTES } });

// multer throws its own MulterError outside the promise chain asyncHandler
// wraps — translate it into the client-safe AppError shape here so a
// too-large upload doesn't fall through to a raw 500.
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('validation failed: file too large (max 10MB)', 400));
    }
    return next(new AppError('validation failed: file', 400));
  });
}

// Auth applied at the router level, not ad-hoc per route — CLAUDE.md § Non-Negotiables.
const router = Router();
router.use(requireAuth);

router.post('/preview', handleUpload, asyncHandler(importsController.preview));
router.post('/:id/confirm', asyncHandler(importsController.confirm));

module.exports = router;
