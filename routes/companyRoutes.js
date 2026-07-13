const express = require('express');
const { randomUUID } = require('crypto');
const Company = require('../models/Company');
const Employer = require('../models/Employer');
const { ensureCollection, readCollection, writeCollection } = require('../services/jsonDatabase');

const router = express.Router();

ensureCollection('companies');
router.use(express.json());

router.get('/api/companies', (request, response) => {
    const companies = readCollection('companies');
    const employers = readCollection('users').filter(user => user.role === 'Employer');

    response.json(companies.map(company => ({
        ...company,
        employerCount: employers.filter(employer => employer.companyId === company.id).length
    })));
});

router.get('/api/companies/:id', (request, response) => {
    const company = readCollection('companies').find(record => record.id === request.params.id);
    if (!company) return response.status(404).json({ error: 'Company not found.' });

    const employers = readCollection('users')
        .filter(user => user.role === 'Employer' && user.companyId === company.id)
        .map(user => ({ id: user.id, email: user.email }));

    return response.json({ ...company, employers });
});

router.post('/api/companies', (request, response) => {
    try {
        const users = readCollection('users');
        const employerRecord = users.find(user => String(user.id) === String(request.body.employerId));

        if (!employerRecord || employerRecord.role !== 'Employer') {
            return response.status(400).send('<h2>Error: A valid employer account is required.</h2><a href="/register.html">Register an Employer</a>');
        }

        const employer = Employer.fromUser(employerRecord);
        if (employer.companyId) {
            return response.status(409).send('<h2>Error: This employer already belongs to a company.</h2><a href="/dashboard.html">Dashboard</a>');
        }

        const companies = readCollection('companies');
        const companyEmail = request.body.email?.trim().toLowerCase();
        if (companies.some(company => company.email === companyEmail)) {
            return response.status(409).send('<h2>Error: A company with this email already exists.</h2><a href="javascript:history.back()">Go Back</a>');
        }

        const company = new Company({
            id: `company-${randomUUID()}`,
            name: request.body.companyName,
            description: request.body.description,
            industry: request.body.industry,
            address: request.body.address,
            email: companyEmail,
            phone: request.body.phone,
            website: request.body.website
        });

        employer.joinCompany(company.id);
        employerRecord.companyId = employer.companyId;
        companies.push(company.toJSON());

        writeCollection('companies', companies);
        writeCollection('users', users);

        return response.redirect('/dashboard.html');
    } catch (error) {
        return response.status(400).send(`<h2>Error: ${escapeHtml(error.message)}</h2><a href="javascript:history.back()">Go Back</a>`);
    }
});

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

module.exports = router;
