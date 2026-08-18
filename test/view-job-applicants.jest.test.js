const { listApplicantsForJob } = require('../services/applicantService');

describe('User Story: employer views all applicants for a job opening', () => {
    const employerId = 101;
    const jobId = 7;

    function database() {
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
            ]
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
        expect(() => listApplicantsForJob(jobId, 999, database())).toThrow(
            'You can only view applicants for your own job openings.'
        );
    });
});
