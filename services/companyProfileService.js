const { randomUUID } = require('crypto');
const Company = require('../models/Company');
const Employer = require('../models/Employer');
const jsonDatabase = require('./jsonDatabase');

class CompanyProfileError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'CompanyProfileError';
        this.statusCode = statusCode;
    }
}

function createCompanyProfile(profile, database = jsonDatabase, idFactory = randomUUID) {
    const users = database.readCollection('users');
    const companies = database.readCollection('companies');
    const employerRecord = users.find(user => String(user.id) === String(profile.employerId));

    if (!employerRecord || employerRecord.role !== 'Employer') {
        throw new CompanyProfileError('A valid employer account is required.');
    }

    const employer = Employer.fromUser(employerRecord);
    if (employer.companyId) {
        throw new CompanyProfileError('This employer already belongs to a company.', 409);
    }

    const companyEmail = profile.email?.trim().toLowerCase();
    if (companies.some(company => company.email.toLowerCase() === companyEmail)) {
        throw new CompanyProfileError('A company with this email already exists.', 409);
    }

    const company = new Company({
        id: `company-${idFactory()}`,
        name: profile.companyName,
        description: profile.description,
        industry: profile.industry,
        address: profile.address,
        email: companyEmail,
        phone: profile.phone,
        website: profile.website
    });

    employer.joinCompany(company.id);
    employerRecord.companyId = employer.companyId;
    companies.push(company.toJSON());

    database.writeCollection('companies', companies);
    database.writeCollection('users', users);

    return company.toJSON();
}

module.exports = { CompanyProfileError, createCompanyProfile };
