const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');

test('user profile API and application profile completeness validation', async t => {
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    }));

    await once(server, 'listening');
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Test GET /api/profile for existing user
    const getRes = await fetch(`${baseUrl}/api/profile?userId=1785053640961`);
    assert.equal(getRes.status, 200);
    const userData = await getRes.json();
    assert.equal(userData.id, 1785053640961);
    assert.equal(userData.password, undefined); // password should be excluded
    assert.ok(userData.profile);

    // Test GET /api/profile with missing userId
    const missingRes = await fetch(`${baseUrl}/api/profile`);
    assert.equal(missingRes.status, 400);

    // Test GET /api/profile with invalid user ID
    const notFoundRes = await fetch(`${baseUrl}/api/profile?userId=999999999999`);
    assert.equal(notFoundRes.status, 404);

    // Test PUT /api/profile to update profile attributes
    const putRes = await fetch(`${baseUrl}/api/profile?userId=1785053640961`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            profile: { fullName: 'Amanda Test' },
            skills: ['Node.js', 'Testing']
        })
    });
    assert.equal(putRes.status, 200);
    const putData = await putRes.json();
    assert.equal(putData.success, true);
});
