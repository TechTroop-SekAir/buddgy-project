'use strict';

// Barrel — implementation lives in ./advisor/ (constants, essential-envelope
// blocklist, tool definitions, the provide_verdict schema, the system
// prompt, and the pure verdict-resolution logic, each in their own file).
// Kept as a re-export at this path so the controller
// (controllers/advisorController.js) and existing tests don't need to know
// the module was split.
module.exports = require('./advisor');
