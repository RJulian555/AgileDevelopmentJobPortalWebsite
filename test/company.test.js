const test = require('node:test');
const assert = require('node:assert/strict');
const Company = require('../models/Company');
const Employer = require('../models/Employer');
const companies = require('../data/companies.json');
const users = require('../data/users.json');

test('all seeded company records satisfy the Company schema', () => {
    assert.equal(companies.length, 5);
    companies.forEach(record => assert.doesNotThrow(() => new Company(record)));
});

test('an Employer can be linked to an existing Company', () => {
    const employerRecord = users.find(user => user.role === 'Employer');
    const employer = Employer.fromUser(employerRecord);

    assert.ok(companies.some(company => company.id === employer.companyId));
});

test('a non-employer user cannot be converted to an Employer entity', () => {
    const jobSeeker = users.find(user => user.role === 'Job Seeker');
    assert.throws(() => Employer.fromUser(jobSeeker), /Employer role/);
});

test('Company rejects invalid required data', () => {
    assert.throws(() => new Company({ id: 'company-invalid' }), /name is required/);
});
