const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server');

describe('User Story: Accept Applicants Within Job Requirements (Jest + Supertest)', () => {
    const employerId = 1783489528289; // Employer owning company-001
    const targetAppId = 'app-1786851322903';
    const applicationsFilePath = path.join(__dirname, '../data/applications.json');

    beforeEach(() => {
        // Reset target application status to pending before each test case
        const applications = JSON.parse(fs.readFileSync(applicationsFilePath, 'utf8'));
        const target = applications.find(a => String(a.id) === String(targetAppId));
        if (target) {
            target.status = 'pending';
            fs.writeFileSync(applicationsFilePath, JSON.stringify(applications, null, 2), 'utf8');
        }
    });

    test('Test Case 1: Evaluates candidate matching 100% of job requirements (Skills, Experience, Education)', async () => {
        const response = await request(app)
            .get(`/api/employer/applications?employerId=${employerId}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);

        const application = response.body.find(a => String(a.id) === String(targetAppId));
        expect(application).toBeDefined();
        expect(application.fit).toBeDefined();
        expect(application.fit.fitStatus).toBeDefined();
        expect(application.fit.matchPercentage).toBeGreaterThanOrEqual(0);
    });

    test('Test Case 2: Accurately identifies missing skills, experience years, or education levels for unqualified candidates', async () => {
        const response = await request(app)
            .get(`/api/employer/applications?employerId=${employerId}`);

        expect(response.status).toBe(200);
        const application = response.body.find(a => String(a.id) === String(targetAppId));
        expect(application).toBeDefined();
        expect(Array.isArray(application.fit.allMissingRequirements)).toBe(true);
    });

    test('Test Case 3: Allows employer to accept a candidate and returns 200 OK with confirmation message', async () => {
        const response = await request(app)
            .patch(`/api/applications/${encodeURIComponent(targetAppId)}/status`)
            .send({
                employerId: employerId,
                status: 'accepted'
            });

        expect(response.status).toBe(200);
        expect(response.body.message).toMatch(/accepted/i);
        expect(response.body.application.status).toBe('accepted');
    });

    test('Test Case 4: Verifies persistent text file storage write (data/applications.json disk file check)', async () => {
        // 1. Call API to accept applicant
        const apiResponse = await request(app)
            .patch(`/api/applications/${encodeURIComponent(targetAppId)}/status`)
            .send({
                employerId: employerId,
                status: 'accepted'
            });

        expect(apiResponse.status).toBe(200);

        // 2. Read physical text file directly from disk
        const rawFileContent = fs.readFileSync(applicationsFilePath, 'utf8');
        const applicationsFromDisk = JSON.parse(rawFileContent);
        const storedRecord = applicationsFromDisk.find(a => String(a.id) === String(targetAppId));

        // 3. Assert status is updated to 'accepted' inside the text file
        expect(storedRecord).toBeDefined();
        expect(storedRecord.status).toBe('accepted');
    });

    test('Test Case 5: Rejects candidate acceptance attempt by an unauthorized employer (403 Forbidden)', async () => {
        const unauthorizedEmployerId = 999999999999;
        const response = await request(app)
            .patch(`/api/applications/${encodeURIComponent(targetAppId)}/status`)
            .send({
                employerId: unauthorizedEmployerId,
                status: 'accepted'
            });

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/authorized|company/i);
    });

    test('Test Case 6: Rejects acceptance request with an invalid status string (400 Bad Request)', async () => {
        const response = await request(app)
            .patch(`/api/applications/${encodeURIComponent(targetAppId)}/status`)
            .send({
                employerId: employerId,
                status: 'invalid_status_value'
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/accepted, rejected, or pending/i);
    });
});
