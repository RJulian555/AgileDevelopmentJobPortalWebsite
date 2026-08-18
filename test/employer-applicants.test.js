const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');

test('Employer applicants review, requirements fit scoring, and applicant acceptance', async t => {
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    }));

    await once(server, 'listening');
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const employerId = 1783489528289; // Employer linked to company-001

    // 1. GET /api/employer/applications
    const getRes = await fetch(`${baseUrl}/api/employer/applications?employerId=${employerId}`);
    assert.equal(getRes.status, 200);
    const applications = await getRes.json();
    assert.ok(Array.isArray(applications));
    assert.ok(applications.length > 0);

    const firstApp = applications[0];
    assert.ok(firstApp.id);
    assert.ok(firstApp.jobTitle);
    assert.ok(firstApp.seekerName);
    assert.ok(firstApp.fit);
    assert.ok(Array.isArray(firstApp.fit.matchedSkills));
    assert.ok(['Meets Requirements', 'Partial Match', 'Below Requirements'].includes(firstApp.fit.fitStatus));

    // 2. PATCH /api/applications/:id/status -> accept applicant
    const acceptRes = await fetch(`${baseUrl}/api/applications/${encodeURIComponent(firstApp.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employerId: employerId,
            status: 'accepted'
        })
    });
    assert.equal(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.match(acceptData.message, /accepted/i);
    assert.equal(acceptData.application.status, 'accepted');

    // 3. Reject unauthorized update attempt by unrelated user/employer
    const unauthorizedRes = await fetch(`${baseUrl}/api/applications/${encodeURIComponent(firstApp.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employerId: 999999999999,
            status: 'accepted'
        })
    });
    assert.equal(unauthorizedRes.status, 403);
});
