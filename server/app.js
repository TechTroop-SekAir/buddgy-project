'use strict';

const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.use('/api', apiRouter);

// Must be registered last — after every route.
app.use(errorHandler);

module.exports = app;
