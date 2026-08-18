const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('employer applicant API serves a job list, details, and empty results', async t => {
    const server = app.listen(0);
    t.after(() => new Promise(resolve => server.close(resolve)));
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const employerId = '1783489528289';

    const listResponse = await fetch(`${baseUrl}/api/jobs/1/applicants?employerId=${employerId}`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.job.id, 1);
    assert.equal(list.applicants.length, 2);
    assert.ok(list.applicants[0].resumeUrl);

    const detailResponse = await fetch(
        `${baseUrl}/api/jobs/1/applicants/${encodeURIComponent(list.applicants[0].applicationId)}?employerId=${employerId}`
    );
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.equal(detail.applicant.applicationId, list.applicants[0].applicationId);
    assert.equal(detail.applicant.profile.password, undefined);

    const emptyResponse = await fetch(`${baseUrl}/api/jobs/4/applicants?employerId=${employerId}`);
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual((await emptyResponse.json()).applicants, []);

    const forbiddenResponse = await fetch(`${baseUrl}/api/jobs/1/applicants?employerId=999`);
    assert.equal(forbiddenResponse.status, 403);

    const pageResponse = await fetch(`${baseUrl}/applicants.html`);
    assert.equal(pageResponse.status, 200);
    assert.match(await pageResponse.text(), /No applicants yet/i);
});
