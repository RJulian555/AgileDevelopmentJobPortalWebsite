const request = require('supertest');
const app = require('../server');

describe('US-09: employer views applicants from a job opening', () => {
    const employerId = '1783489528289';
    const jobWithApplicants = 'job-3dd57089-d799-48ea-a9bb-93802cfba487';
    const jobWithoutApplicants = '1';

    test('displays every applicant for the selected job opening', async () => {
        const pageResponse = await request(app)
            .get(`/applicants.html?jobId=${encodeURIComponent(jobWithApplicants)}&employerId=${employerId}`);
        const listResponse = await request(app)
            .get(`/api/jobs/${encodeURIComponent(jobWithApplicants)}/applicants`)
            .query({ employerId });

        expect(pageResponse.status).toBe(200);
        expect(pageResponse.text).toMatch(/Job applicants/i);
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.job.id).toBe(jobWithApplicants);
        expect(listResponse.body.applicants.length).toBeGreaterThan(0);
    });

    test('lets the employer select an applicant and review their qualifications', async () => {
        const listResponse = await request(app)
            .get(`/api/jobs/${encodeURIComponent(jobWithApplicants)}/applicants`)
            .query({ employerId });
        const selectedApplicant = listResponse.body.applicants[0];

        const detailResponse = await request(app)
            .get(
                `/api/jobs/${encodeURIComponent(jobWithApplicants)}`
                + `/applicants/${encodeURIComponent(selectedApplicant.applicationId)}`
            )
            .query({ employerId });

        expect(detailResponse.status).toBe(200);
        expect(detailResponse.body.applicant).toMatchObject({
            applicationId: selectedApplicant.applicationId,
            resumeUrl: expect.any(String),
            profile: {
                fullName: expect.any(String),
                skills: expect.any(Array),
                work: expect.any(Array),
                education: expect.any(Array)
            }
        });
        expect(detailResponse.body.applicant.profile).not.toHaveProperty('password');
    });

    test('shows the no-applicants state for a job opening with no applications', async () => {
        const pageResponse = await request(app).get('/applicants.html');
        const listResponse = await request(app)
            .get(`/api/jobs/${jobWithoutApplicants}/applicants`)
            .query({ employerId });

        expect(pageResponse.status).toBe(200);
        expect(pageResponse.text).toMatch(/No applicants yet/i);
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.applicants).toEqual([]);
    });

    test('blocks another employer from viewing the job applicants', async () => {
        const response = await request(app)
            .get(`/api/jobs/${encodeURIComponent(jobWithApplicants)}/applicants`)
            .query({ employerId: '999' });

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/only view applicants for your own job openings/i);
    });
});
