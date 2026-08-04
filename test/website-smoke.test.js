const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');

test('website serves the dashboard and core job APIs', async t => {
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    }));

    await once(server, 'listening');
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const dashboardResponse = await fetch(`${baseUrl}/dashboard.html`);
    assert.equal(dashboardResponse.status, 200);
    assert.match(
        dashboardResponse.headers.get('content-type') || '',
        /^text\/html/
    );
    assert.match(await dashboardResponse.text(), /JobWall/);

    const jobsResponse = await fetch(`${baseUrl}/api/jobs`);
    assert.equal(jobsResponse.status, 200);
    assert.ok(Array.isArray(await jobsResponse.json()));

    const optionsResponse = await fetch(`${baseUrl}/api/job-options`);
    assert.equal(optionsResponse.status, 200);
    const options = await optionsResponse.json();
    assert.ok(Array.isArray(options.jobTitles));
    assert.ok(Array.isArray(options.locations));
    assert.ok(Array.isArray(options.employmentTypes));

    const createResponse = await fetch(`${baseUrl}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    assert.equal(createResponse.status, 403);
    assert.match(
        createResponse.headers.get('content-type') || '',
        /^application\/json/
    );
    assert.match((await createResponse.json()).error, /employer account/i);

    const missingApiResponse = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(missingApiResponse.status, 404);
    assert.match(
        missingApiResponse.headers.get('content-type') || '',
        /^application\/json/
    );
    assert.match((await missingApiResponse.json()).error, /API route not found/);
});
