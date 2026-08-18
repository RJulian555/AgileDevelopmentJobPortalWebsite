const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'company-profile.html'), 'utf8');

test('company portfolio page provides the complete edit controls', () => {
    assert.match(page, /id="editCompanyButton"[^>]*>Edit Company</);
    assert.match(page, /id="cancelButton"/);
    assert.match(page, /Save Changes/);
    assert.match(page, /fillForm\(currentCompany\)/);
});

test('cancel editing restores the saved portfolio without sending an update', () => {
    assert.match(page, /form\.reset\(\);\s*editing = false;\s*showMessage\('Editing cancelled\. No changes were saved\.'/);
    assert.match(page, /displayCompanyProfile\(currentCompany\)/);
});

test('edit form includes browser validation for name, email, website, and phone', () => {
    assert.match(page, /id="companyName"[^>]*required/);
    assert.match(page, /id="email"[^>]*type="email"[^>]*required/);
    assert.match(page, /id="website"[^>]*type="url"/);
    assert.match(page, /id="phone"[^>]*pattern=/);
});
