const express = require('express');
const { ensureCollection, readCollection } = require('../services/jsonDatabase');
const { createCompanyProfile } = require('../services/companyProfileService');

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
        const company = createCompanyProfile(request.body);

        if (wantsJson(request)) {
            return response.status(201).json({
                message: 'Company profile created successfully.',
                company,
                redirectUrl: '/dashboard.html'
            });
        }

        return response.redirect(303, '/dashboard.html');
    } catch (error) {
        const statusCode = error.statusCode || 400;
        if (wantsJson(request)) {
            return response.status(statusCode).json({ error: error.message });
        }

        return response.status(statusCode).send(`<h2>Error: ${escapeHtml(error.message)}</h2><a href="javascript:history.back()">Go Back</a>`);
    }
});

function wantsJson(request) {
    return request.is('application/json') || request.get('accept')?.includes('application/json');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

module.exports = router;
