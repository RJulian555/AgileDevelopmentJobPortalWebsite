const { randomUUID } = require('crypto');
const Company = require('../models/Company');
const Employer = require('../models/Employer');
const jsonDatabase = require('./jsonDatabase');
const { storeCompanyLogo } = require('./companyLogoStorage');

class CompanyProfileError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'CompanyProfileError';
        this.statusCode = statusCode;
    }
}

function createCompanyProfile(profile, database = jsonDatabase, idFactory = randomUUID, logoStorage = storeCompanyLogo) {
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

    const companyId = `company-${idFactory()}`;
    const company = new Company({
        id: companyId,
        name: profile.companyName,
        description: profile.description,
        industry: profile.industry,
        address: profile.address,
        email: companyEmail,
        phone: profile.phone,
        website: profile.website
    });
    company.logoUrl = logoStorage(companyId, profile.logoData);

    employer.joinCompany(company.id);
    employerRecord.companyId = employer.companyId;
    companies.push(company.toJSON());

    database.writeCollection('companies', companies);
    database.writeCollection('users', users);

    return company.toJSON();
}

function updateCompanyLogo(details, database = jsonDatabase, logoStorage = storeCompanyLogo) {
    const users = database.readCollection('users');
    const companies = database.readCollection('companies');
    const employer = users.find(user => String(user.id) === String(details.employerId));
    const company = companies.find(record => record.id === details.companyId);

    if (!employer || employer.role !== 'Employer' || employer.companyId !== details.companyId) {
        throw new CompanyProfileError('Only an Employer linked to this company can update its logo.', 403);
    }

    if (!company) throw new CompanyProfileError('Company not found.', 404);
    if (!details.logoData) throw new CompanyProfileError('Please select a company logo.');

    company.logoUrl = logoStorage(company.id, details.logoData);
    company.updatedAt = new Date().toISOString();
    database.writeCollection('companies', companies);

    return company;
}

module.exports = { CompanyProfileError, createCompanyProfile, updateCompanyLogo };
