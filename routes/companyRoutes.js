const express = require('express');
const { ensureCollection, readCollection } = require('../services/jsonDatabase');
const { createCompanyProfile, updateCompanyLogo, updateCompanyProfile } = require('../services/companyProfileService');

const router = express.Router();

ensureCollection('companies');
router.use(express.json({ limit: '3mb' }));

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

router.get('/api/employers/:employerId/company', (request, response) => {
    const employer = readCollection('users').find(user =>
        String(user.id) === String(request.params.employerId) && user.role === 'Employer'
    );
    if (!employer) return response.status(404).json({ error: 'Employer not found.' });
    if (!employer.companyId) return response.status(404).json({ error: 'No company profile exists for this employer.' });

    const company = readCollection('companies').find(record => record.id === employer.companyId);
    if (!company) return response.status(404).json({ error: 'Company not found.' });
    return response.json(company);
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

router.patch('/api/companies/:id/logo', (request, response) => {
    try {
        const company = updateCompanyLogo({
            companyId: request.params.id,
            employerId: request.body.employerId,
            logoData: request.body.logoData
        });

        return response.json({ message: 'Company logo saved successfully.', company });
    } catch (error) {
        return response.status(error.statusCode || 400).json({ error: error.message });
    }
});

router.put('/api/companies/:id', (request, response) => {
    try {
        const company = updateCompanyProfile({
            ...request.body,
            companyId: request.params.id
        });
        return response.json({ message: 'Company portfolio updated successfully.', company });
    } catch (error) {
        return response.status(error.statusCode || 400).json({ error: error.message });
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
