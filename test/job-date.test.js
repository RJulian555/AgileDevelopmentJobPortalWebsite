const test = require('node:test');
const assert = require('node:assert/strict');
const { formatRelativeDate, parseLocalDateOnly } = require('../public/js/jobDate');

test('a job posted just after local midnight displays as posted today', () => {
    const justAfterMidnight = new Date(2026, 6, 30, 0, 53);
    assert.equal(formatRelativeDate('2026-07-30', justAfterMidnight), 'today');
});

test('date-only job timestamps are parsed as local calendar dates', () => {
    const parsed = parseLocalDateOnly('2026-07-30');
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 6);
    assert.equal(parsed.getDate(), 30);
});

test('the previous local calendar date displays as yesterday', () => {
    const justAfterMidnight = new Date(2026, 6, 30, 0, 53);
    assert.equal(formatRelativeDate('2026-07-29', justAfterMidnight), 'yesterday');
});
