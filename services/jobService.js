const { randomUUID } = require('crypto');
const Job = require('../models/Job');
const jsonDatabase = require('./jsonDatabase');

class JobServiceError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'JobServiceError';
        this.statusCode = statusCode;
    }
}

function createJobOpening(
    details,
    database = jsonDatabase,
    idFactory = randomUUID,
    nowFactory = () => new Date()
) {
    const users = database.readCollection('users');
    const companies = database.readCollection('companies');
    const jobs = database.readCollection('jobs');
    const employer = users.find(user => String(user.id) === String(details.employerId));

    if (!employer || employer.role !== 'Employer') {
        throw new JobServiceError('A valid employer account is required.', 403);
    }

    if (!employer.companyId) {
        throw new JobServiceError('Create or join a company before posting a job.', 403);
    }

    const company = companies.find(record => record.id === employer.companyId);
    if (!company) {
        throw new JobServiceError('The employer company could not be found.', 404);
    }

    const now = nowFactory();
    let job;

    try {
        job = new Job({
            id: `job-${idFactory()}`,
            companyId: company.id,
            company: company.name,
            createdByEmployerId: employer.id,
            title: details.title,
            description: details.description,
            salary: details.salary,
            employmentType: details.employmentType,
            location: details.location,
            skillsRequired: details.skillsRequired,
            experienceRequired: details.experienceRequired,
            educationLevel: details.educationLevel,
            closingDate: details.closingDate,
            industry: company.industry,
            postedAt: toLocalDateOnly(now),
            createdAt: now.toISOString()
        }, { today: now });
    } catch (error) {
        throw new JobServiceError(error.message);
    }

    const duplicate = jobs.some(existingJob =>
        (existingJob.companyId === company.id
            || (!existingJob.companyId && existingJob.company === company.name))
        && normaliseTitle(existingJob.title) === normaliseTitle(job.title)
    );
    if (duplicate) {
        throw new JobServiceError(
            `${company.name} already has a job opening for ${job.title}.`,
            409
        );
    }

    jobs.push(job.toJSON());
    database.writeCollection('jobs', jobs);
    return job.toJSON();
}

function toLocalDateOnly(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normaliseTitle(title) {
    return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

module.exports = { JobServiceError, createJobOpening };
