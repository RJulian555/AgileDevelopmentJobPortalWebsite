const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { storeCompanyLogo } = require('../services/companyLogoStorage');

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwX9WQAAAABJRU5ErkJggg==';

test('validates and writes an uploaded company logo', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'company-logo-'));

    try {
        const logoUrl = storeCompanyLogo('company-test', onePixelPng, directory);
        assert.equal(logoUrl, '/uploads/company-logos/company-test.png');
        assert.ok(fs.statSync(path.join(directory, 'company-test.png')).size > 0);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('rejects content whose signature does not match its image type', () => {
    const fakePng = `data:image/png;base64,${Buffer.from('not an image').toString('base64')}`;
    assert.throws(() => storeCompanyLogo('company-test', fakePng), /does not match/);
});
