const { readCollection } = require('../services/jsonDatabase');
const { createJobOpening } = require('../services/jobService');
const jobOptions = require('../config/jobOptions');

function listJobs(request, response) {
    const query = String(request.query.q || '').trim().toLowerCase();
    const jobs = readCollection('jobs');
    const results = query
        ? jobs.filter(job => String(job.title || '').toLowerCase().includes(query))
        : jobs;

    return response.json(results);
}

function storeJob(request, response) {
    try {
        const job = createJobOpening(request.body);
        return response.status(201).json({
            message: 'Job opening created successfully.',
            job,
            redirectUrl: '/dashboard.html'
        });
    } catch (error) {
        return response.status(error.statusCode || 400).json({
            error: error.message || 'Unable to create the job opening.'
        });
    }
}

function getJobOptions(request, response) {
    return response.json(jobOptions);
}

module.exports = { getJobOptions, listJobs, storeJob };
