const test = require('node:test');
const assert = require('node:assert/strict');
const { createJobOpening } = require('../services/jobService');

const fixedNow = new Date(2026, 6, 29, 10, 0, 0);
const validJob = {
    employerId: 101,
    title: 'Backend Developer',
    description: 'Build and maintain reliable services for our customers.',
    salary: '6500',
    employmentType: 'Full-Time',
    location: 'Kuala Lumpur, Malaysia',
    skillsRequired: 'Node.js, Express, Git',
    experienceRequired: '1-2 years',
    educationLevel: "Bachelor's Degree",
    closingDate: '2026-08-31'
};

function createMemoryDatabase() {
    const collections = {
        users: [{
            id: 101,
            email: 'employer@example.com',
            role: 'Employer',
            companyId: 'company-101'
        }],
        companies: [{
            id: 'company-101',
            name: 'Sprint Works',
            industry: 'technology'
        }],
        jobs: []
    };

    return {
        collections,
        readCollection(name) {
            return structuredClone(collections[name]);
        },
        writeCollection(name, records) {
            collections[name] = structuredClone(records);
        }
    };
}

function createJob(overrides = {}, database = createMemoryDatabase()) {
    const job = createJobOpening(
        { ...validJob, ...overrides },
        database,
        () => 'test-id',
        () => fixedNow
    );
    return { job, database };
}

test('creates a job and links it with the employer company', () => {
    const { job, database } = createJob();

    assert.equal(job.id, 'job-test-id');
    assert.equal(job.companyId, 'company-101');
    assert.equal(job.company, 'Sprint Works');
    assert.equal(job.createdByEmployerId, 101);
    assert.equal(job.salary, 6500);
    assert.deepEqual(job.skillsRequired, ['Node.js', 'Express', 'Git']);
    assert.deepEqual(database.collections.jobs, [job]);
});

test('rejects a job with missing required fields', () => {
    assert.throws(
        () => createJob({ title: '' }),
        error => error.statusCode === 400 && /Title is required/.test(error.message)
    );
});

test('rejects a non-numeric salary', () => {
    assert.throws(
        () => createJob({ salary: 'six thousand' }),
        error => error.statusCode === 400 && /Salary must be a valid/.test(error.message)
    );
});

test('rejects a closing date that is not after today', () => {
    assert.throws(
        () => createJob({ closingDate: '2026-07-29' }),
        error => error.statusCode === 400 && /after today/.test(error.message)
    );
});

test('rejects an employer who is not linked to a company', () => {
    const database = createMemoryDatabase();
    database.collections.users[0].companyId = null;

    assert.throws(
        () => createJob({}, database),
        error => error.statusCode === 403 && /company before posting/.test(error.message)
    );
});

test('rejects a duplicate job title for the same company', () => {
    const database = createMemoryDatabase();
    createJob({}, database);

    assert.throws(
        () => createJob({ title: '  backend developer  ' }, database),
        error => error.statusCode === 409 && /already has a job opening/.test(error.message)
    );
    assert.equal(database.collections.jobs.length, 1);
});

test('allows the same job title at a different company', () => {
    const database = createMemoryDatabase();
    createJob({}, database);
    database.collections.users.push({
        id: 202,
        email: 'other@example.com',
        role: 'Employer',
        companyId: 'company-202'
    });
    database.collections.companies.push({
        id: 'company-202',
        name: 'Other Company',
        industry: 'technology'
    });

    const { job } = createJob({ employerId: 202 }, database);
    assert.equal(job.companyId, 'company-202');
    assert.equal(database.collections.jobs.length, 2);
});

test('rejects rubbish in controlled job fields', () => {
    assert.throws(
        () => createJob({ experienceRequired: 'I have lots probably' }),
        error => error.statusCode === 400 && /Experience required must be selected/.test(error.message)
    );
    assert.throws(
        () => createJob({ location: 'Somewhere near my house' }),
        error => error.statusCode === 400 && /Location must be selected/.test(error.message)
    );
    assert.throws(
        () => createJob({ skillsRequired: 'Being awesome' }),
        error => error.statusCode === 400 && /not an available skill/.test(error.message)
    );
});
