const express = require('express');
const { ensureCollection } = require('../services/jsonDatabase');
const { getJobOptions, listJobs, storeJob } = require('../controllers/jobController');

const router = express.Router();

ensureCollection('jobs');
router.get('/api/job-options', getJobOptions);
router.get('/api/jobs', listJobs);
router.post('/api/jobs', storeJob);

module.exports = router;
