const fs = require('fs');
const path = require('path');
const {
    getApplicantForJob,
    listApplicantsForJob
} = require('../services/applicantService');

describe('User Story: employer views all applicants for a job opening', () => {
    const employerId = 101;
    const jobId = 7;

    function database(overrides = {}) {
        const records = {
            jobs: [
                {
                    id: jobId,
                    title: 'Software Developer',
                    company: 'Acme',
                    createdByEmployerId: employerId
                },
                {
                    id: 8,
                    title: 'Product Designer',
                    company: 'Acme',
                    createdByEmployerId: employerId
                }
            ],
            applications: [
                {
                    id: 'application-1',
                    jobId,
                    seekerId: 201,
                    coverLetter: 'I have five years of Node.js experience.'
                },
                {
                    id: 'application-2',
                    jobId: String(jobId),
                    seekerId: 202,
                    coverLetter: 'I recently completed a web development diploma.'
                },
                {
                    id: 'application-other-job',
                    jobId: 8,
                    seekerId: 203
                }
            ],
            users: [
                {
                    id: 201,
                    role: 'Job Seeker',
                    email: 'alex@example.com',
                    password: 'hashed-secret',
                    profile: {
                        fullName: 'Alex Tan',
                        jobTitle: 'Backend Developer',
                        location: 'Kuala Lumpur'
                    },
                    skills: ['Node.js', 'SQL'],
                    work: [{ company: 'Previous Co', title: 'Developer' }],
                    edu: [{ level: "Bachelor's Degree", major: 'Computer Science' }]
                },
                {
                    id: 202,
                    role: 'Job Seeker',
                    email: 'jamie@example.com',
                    password: 'another-secret',
                    profile: {
                        fullName: 'Jamie Lee',
                        jobTitle: 'Junior Developer',
                        location: 'Penang'
                    },
                    skills: ['JavaScript', 'HTML'],
                    work: [],
                    edu: [{ level: 'Diploma', major: 'Web Development' }]
                },
                {
                    id: 203,
                    role: 'Job Seeker',
                    email: 'other@example.com',
                    profile: { fullName: 'Other Applicant' }
                }
            ],
            resumes: [
                { userId: 201, resumeUrl: 'uploads/alex-resume.pdf' },
                { userId: 202, resumeUrl: '/uploads/jamie-resume.pdf' }
            ],
            ...overrides
        };

        return { readCollection: collection => records[collection] || [] };
    }

    test('returns every applicant for the selected job with reviewable qualifications', () => {
        const result = listApplicantsForJob(jobId, employerId, database());

        expect(result.job).toMatchObject({
            id: jobId,
            title: 'Software Developer',
            company: 'Acme'
        });
        expect(result.applicants).toHaveLength(2);
        expect(result.applicants.map(applicant => applicant.applicationId))
            .toEqual(['application-1', 'application-2']);

        expect(result.applicants[0]).toMatchObject({
            coverLetter: 'I have five years of Node.js experience.',
            resumeUrl: '/uploads/alex-resume.pdf',
            profile: {
                fullName: 'Alex Tan',
                jobTitle: 'Backend Developer',
                skills: ['Node.js', 'SQL'],
                work: [{ company: 'Previous Co', title: 'Developer' }],
                education: [{ level: "Bachelor's Degree", major: 'Computer Science' }]
            }
        });
        expect(result.applicants[1].profile).toMatchObject({
            fullName: 'Jamie Lee',
            skills: ['JavaScript', 'HTML'],
            education: [{ level: 'Diploma', major: 'Web Development' }]
        });

        result.applicants.forEach(applicant => {
            expect(applicant.profile).not.toHaveProperty('password');
        });
    });

    test('prevents another employer from viewing the job applicants', () => {
        expect.assertions(2);

        try {
            listApplicantsForJob(jobId, 999, database());
        } catch (error) {
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe(
                'You can only view applicants for your own job openings.'
            );
        }
    });

    test('returns an empty list and provides a clear empty-state message when nobody has applied', () => {
        const result = listApplicantsForJob(jobId, employerId, database({
            applications: [
                {
                    id: 'application-other-job',
                    jobId: 8,
                    seekerId: 203
                }
            ]
        }));
        const applicantPage = fs.readFileSync(
            path.join(__dirname, '../public/applicants.html'),
            'utf8'
        );

        expect(result.applicants).toEqual([]);
        expect(applicantPage).toMatch(/No applicants yet/i);
    });

    test.each([
        {
            label: 'a missing employer ID',
            requestedJobId: jobId,
            requestedEmployerId: undefined,
            statusCode: 400,
            message: 'employerId is required.'
        },
        {
            label: 'an unknown job ID',
            requestedJobId: 999,
            requestedEmployerId: employerId,
            statusCode: 404,
            message: 'Job opening not found.'
        }
    ])('rejects $label with a validation error', ({
        requestedJobId,
        requestedEmployerId,
        statusCode,
        message
    }) => {
        expect.assertions(2);

        try {
            listApplicantsForJob(requestedJobId, requestedEmployerId, database());
        } catch (error) {
            expect(error.statusCode).toBe(statusCode);
            expect(error.message).toBe(message);
        }
    });

    test('rejects an application ID that belongs to a different job opening', () => {
        expect.assertions(2);

        try {
            getApplicantForJob(jobId, 'application-other-job', employerId, database());
        } catch (error) {
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Applicant not found for this job opening.');
        }
    });
});
