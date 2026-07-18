const test = require('node:test');
const assert = require('node:assert/strict');
const { createCompanyProfile } = require('../services/companyProfileService');

function createMemoryDatabase() {
    const collections = {
        users: [{ id: 101, email: 'employer@example.com', role: 'Employer', companyId: null }],
        companies: []
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

const validProfile = {
    employerId: 101,
    companyName: 'Sprint Demo Company',
    description: 'Created during an automated backend test.',
    industry: 'technology',
    address: 'Kuala Lumpur, Malaysia',
    email: 'demo@example.com',
    phone: '+60 3-1234 5678',
    website: 'https://demo.example.com'
};

test('creates a company and stores its relationship to the employer', () => {
    const database = createMemoryDatabase();
    const company = createCompanyProfile(validProfile, database, () => 'test-id');

    assert.equal(company.id, 'company-test-id');
    assert.equal(database.collections.companies.length, 1);
    assert.equal(database.collections.users[0].companyId, company.id);
});

test('rejects another profile for an employer that already has a company', () => {
    const database = createMemoryDatabase();
    createCompanyProfile(validProfile, database, () => 'first-id');

    assert.throws(
        () => createCompanyProfile({ ...validProfile, email: 'second@example.com' }, database),
        error => error.statusCode === 409 && /already belongs/.test(error.message)
    );
});

test('rejects a duplicate company email', () => {
    const database = createMemoryDatabase();
    database.collections.companies.push({ email: validProfile.email });

    assert.throws(
        () => createCompanyProfile(validProfile, database),
        error => error.statusCode === 409 && /email already exists/.test(error.message)
    );
});
