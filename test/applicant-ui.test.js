const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'applicants.html'), 'utf8');

test('applicant page includes the scoped US-09 views', () => {
    assert.match(html, /Applicant list/i);
    assert.match(html, /No applicants yet/i);
    assert.match(html, /View resume/i);
    assert.match(html, /Work experience/i);
    assert.match(html, /Cover letter/i);
});

test('applicant page excludes search, filtering, sorting, and decision controls', () => {
    assert.doesNotMatch(html, /type=["']search["']/i);
    assert.doesNotMatch(html, /<select/i);
    assert.doesNotMatch(html, />\s*(accept|reject)\s*</i);
    assert.doesNotMatch(html, /sort by/i);
});
