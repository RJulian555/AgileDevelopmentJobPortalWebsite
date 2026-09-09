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

function getEmployerJobContext(request, response) {
    const employer = readCollection('users').find(user =>
        String(user.id) === String(request.params.employerId)
        && user.role === 'Employer'
    );

    if (!employer) {
        return response.status(404).json({ error: 'Employer account not found.' });
    }

    if (!employer.companyId) {
        return response.status(404).json({ error: 'This employer is not linked to a company.' });
    }

    const company = readCollection('companies').find(record => record.id === employer.companyId);
    if (!company) {
        return response.status(404).json({ error: 'Employer company not found.' });
    }

    const existingJobTitles = readCollection('jobs')
        .filter(job =>
            job.companyId === company.id
            || (!job.companyId && job.company === company.name)
        )
        .map(job => job.title)
        .filter(Boolean);

    return response.json({
        employer: { id: employer.id, email: employer.email },
        company: {
            id: company.id,
            name: company.name,
            industry: company.industry,
            logoUrl: company.logoUrl || ''
        },
        existingJobTitles
    });
}

module.exports = { getEmployerJobContext, getJobOptions, listJobs, storeJob };
