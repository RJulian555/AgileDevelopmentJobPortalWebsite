const test = require('node:test');
const assert = require('node:assert/strict');
const { getApplicantForJob, listApplicantsForJob } = require('../services/applicantService');

function database(overrides = {}) {
    const records = {
        jobs: [
            { id: 7, title: 'Developer', company: 'Acme', createdByEmployerId: 101 },
            { id: 8, title: 'Designer', company: 'Acme', createdByEmployerId: 101 }
        ],
        applications: [
            { id: 'app-1', jobId: '7', seekerId: '201', appliedAt: '2026-08-01T00:00:00Z', coverLetter: 'Hello' },
            { id: 'app-2', jobId: '8', seekerId: '202', appliedAt: '2026-08-02T00:00:00Z' }
        ],
        users: [
            { id: 201, role: 'Job Seeker', email: 'one@example.com', password: 'secret', profile: { fullName: 'One Person', jobTitle: 'Engineer' }, skills: ['Node.js'] },
            { id: 202, role: 'Job Seeker', email: 'two@example.com', profile: { fullName: 'Two Person' } }
        ],
        resumes: [{ userId: 201, resumeUrl: 'uploads/one.pdf' }],
        ...overrides
    };
    return { readCollection: name => records[name] || [] };
}

test('lists only applicants for the requested owned job', () => {
    const result = listApplicantsForJob(7, 101, database());
    assert.equal(result.job.title, 'Developer');
    assert.equal(result.applicants.length, 1);
    assert.equal(result.applicants[0].profile.fullName, 'One Person');
    assert.equal(result.applicants[0].resumeUrl, '/uploads/one.pdf');
});

test('returns an empty list when the job has no applications', () => {
    const db = database({ applications: [] });
    assert.deepEqual(listApplicantsForJob(7, 101, db).applicants, []);
});

test('returns every applicant when a job has many applications', () => {
    const applications = Array.from({ length: 30 }, (_, index) => ({ id: `app-${index}`, jobId: 7, seekerId: 201 }));
    assert.equal(listApplicantsForJob(7, 101, database({ applications })).applicants.length, 30);
});

test('gets full applicant details without exposing password data', () => {
    const result = getApplicantForJob(7, 'app-1', 101, database());
    assert.equal(result.applicant.coverLetter, 'Hello');
    assert.deepEqual(result.applicant.profile.skills, ['Node.js']);
    assert.equal(result.applicant.profile.password, undefined);
});

test('prevents an employer from reading another employer job', () => {
    assert.throws(
        () => listApplicantsForJob(7, 999, database()),
        error => error.statusCode === 403
    );
});

test('rejects an applicant detail that belongs to a different job', () => {
    assert.throws(
        () => getApplicantForJob(7, 'app-2', 101, database()),
        error => error.statusCode === 404
    );
});
