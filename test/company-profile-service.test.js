const test = require('node:test');
const assert = require('node:assert/strict');
const { createCompanyProfile, updateCompanyLogo, updateCompanyProfile } = require('../services/companyProfileService');

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

test('stores the uploaded logo URL with the company profile', () => {
    const database = createMemoryDatabase();
    const logoStorage = (companyId, logoData) => {
        assert.equal(companyId, 'company-logo-id');
        assert.equal(logoData, 'encoded-logo');
        return '/uploads/company-logos/company-logo-id.png';
    };

    const company = createCompanyProfile(
        { ...validProfile, logoData: 'encoded-logo' },
        database,
        () => 'logo-id',
        logoStorage
    );

    assert.equal(company.logoUrl, '/uploads/company-logos/company-logo-id.png');
    assert.equal(database.collections.companies[0].logoUrl, company.logoUrl);
});

test('adds a logo to an existing company owned by the Employer', () => {
    const database = createMemoryDatabase();
    const company = createCompanyProfile(validProfile, database, () => 'existing-id');
    const updated = updateCompanyLogo(
        { companyId: company.id, employerId: 101, logoData: 'new-logo' },
        database,
        (companyId, logoData) => {
            assert.equal(logoData, 'new-logo');
            return `/uploads/company-logos/${companyId}.png`;
        }
    );

    assert.equal(updated.logoUrl, '/uploads/company-logos/company-existing-id.png');
    assert.equal(database.collections.companies[0].logoUrl, updated.logoUrl);
});

test('prevents an unrelated Employer from updating a company logo', () => {
    const database = createMemoryDatabase();
    const company = createCompanyProfile(validProfile, database, () => 'protected-id');
    database.collections.users.push({ id: 202, email: 'other@example.com', role: 'Employer', companyId: null });

    assert.throws(
        () => updateCompanyLogo({ companyId: company.id, employerId: 202, logoData: 'logo' }, database),
        error => error.statusCode === 403
    );
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

test('updates company information and preserves fields managed by the system', () => {
    const database = createMemoryDatabase();
    const original = createCompanyProfile(validProfile, database, () => 'edit-id');
    const updated = updateCompanyProfile({
        ...validProfile,
        companyId: original.id,
        companyName: 'Corrected Company Name',
        email: 'updated@example.com',
        phone: '+60 12-888 9999',
        website: 'https://updated.example.com'
    }, database);

    assert.equal(updated.name, 'Corrected Company Name');
    assert.equal(updated.email, 'updated@example.com');
    assert.equal(updated.id, original.id);
    assert.equal(updated.createdAt, original.createdAt);
    assert.equal(database.collections.companies.length, 1);
});

test('updates the logo while saving edited company information', () => {
    const database = createMemoryDatabase();
    const original = createCompanyProfile(validProfile, database, () => 'edit-logo-id');
    const updated = updateCompanyProfile({
        ...validProfile,
        companyId: original.id,
        logoData: 'replacement-logo'
    }, database, (companyId, logoData) => {
        assert.equal(companyId, original.id);
        assert.equal(logoData, 'replacement-logo');
        return `/uploads/company-logos/${companyId}.webp`;
    });

    assert.equal(updated.logoUrl, '/uploads/company-logos/company-edit-logo-id.webp');
});

test('rejects an empty company name during an update', () => {
    const database = createMemoryDatabase();
    const original = createCompanyProfile(validProfile, database, () => 'empty-name-id');

    assert.throws(
        () => updateCompanyProfile({ ...validProfile, companyId: original.id, companyName: '   ' }, database),
        /name is required/i
    );
});

test('rejects invalid email, website, and phone values during an update', () => {
    const invalidCases = [
        ['email', 'not-an-email', /email must be valid/i],
        ['website', 'ftp://example.com', /valid HTTP or HTTPS URL/i],
        ['phone', 'call-me', /valid phone number/i]
    ];

    invalidCases.forEach(([field, value, expectedMessage], index) => {
        const database = createMemoryDatabase();
        const original = createCompanyProfile(validProfile, database, () => `invalid-${index}`);
        assert.throws(
            () => updateCompanyProfile({ ...validProfile, companyId: original.id, [field]: value }, database),
            expectedMessage
        );
        assert.equal(database.collections.companies[0][field], original[field]);
    });
});

test('prevents an unrelated Employer from editing a company portfolio', () => {
    const database = createMemoryDatabase();
    const original = createCompanyProfile(validProfile, database, () => 'protected-edit-id');
    database.collections.users.push({ id: 202, email: 'other@example.com', role: 'Employer', companyId: null });

    assert.throws(
        () => updateCompanyProfile({ ...validProfile, companyId: original.id, employerId: 202 }, database),
        error => error.statusCode === 403
    );
});
