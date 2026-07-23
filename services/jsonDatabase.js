const fs = require('fs');
const path = require('path');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');

function filePath(collection) {
    return path.join(DATA_DIRECTORY, `${collection}.json`);
}

function ensureCollection(collection) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    const target = filePath(collection);
    if (!fs.existsSync(target)) fs.writeFileSync(target, '[]\n');
}

function readCollection(collection) {
    ensureCollection(collection);
    return JSON.parse(fs.readFileSync(filePath(collection), 'utf8'));
}

function writeCollection(collection, records) {
    fs.writeFileSync(filePath(collection), `${JSON.stringify(records, null, 2)}\n`);
}

module.exports = { ensureCollection, readCollection, writeCollection };
