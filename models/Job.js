const jobOptions = require('../config/jobOptions');

class Job {
    constructor({
        id,
        companyId,
        company,
        createdByEmployerId,
        title,
        description,
        salary,
        employmentType,
        location,
        skillsRequired,
        experienceRequired,
        educationLevel,
        closingDate,
        industry = '',
        postedAt,
        createdAt = new Date().toISOString()
    }, options = {}) {
        this.id = id;
        this.companyId = companyId;
        this.company = company?.trim();
        this.createdByEmployerId = createdByEmployerId;
        this.title = canonicalOption(title, jobOptions.jobTitles);
        this.description = description?.trim();
        this.salary = normaliseSalary(salary);
        this.employmentType = canonicalOption(employmentType, jobOptions.employmentTypes);
        this.location = canonicalOption(location, jobOptions.locations);
        this.skillsRequired = normaliseSkills(skillsRequired);
        this.experienceRequired = canonicalOption(experienceRequired, jobOptions.experienceLevels);
        this.educationLevel = canonicalOption(educationLevel, jobOptions.educationLevels);
        this.closingDate = closingDate?.trim();
        this.industry = industry?.trim() || '';
        this.postedAt = postedAt;
        this.createdAt = createdAt;

        // Aliases keep new records compatible with the existing search cards.
        this.jobType = this.employmentType;
        this.requirements = [
            this.experienceRequired,
            this.educationLevel,
            ...this.skillsRequired
        ].filter(Boolean);

        this.validate(options.today || new Date());
    }

    validate(today) {
        const requiredFields = [
            'id',
            'companyId',
            'company',
            'createdByEmployerId',
            'title',
            'description',
            'employmentType',
            'location',
            'experienceRequired',
            'educationLevel',
            'closingDate',
            'postedAt'
        ];
        const missingField = requiredFields.find(field => !this[field]);

        if (missingField) {
            throw new Error(`${fieldLabel(missingField)} is required.`);
        }

        if (this.salary === null) {
            throw new Error('Salary is required.');
        }

        if (!Number.isFinite(this.salary) || this.salary < 0) {
            throw new Error('Salary must be a valid non-negative number.');
        }

        if (this.skillsRequired.length === 0) {
            throw new Error('Skills required is required.');
        }

        const invalidSkill = this.skillsRequired.find(skill => !jobOptions.skills.includes(skill));
        if (invalidSkill) {
            throw new Error(`"${invalidSkill}" is not an available skill.`);
        }

        validateControlledOption(this.title, jobOptions.jobTitles, 'Job title');
        validateControlledOption(this.location, jobOptions.locations, 'Location');
        validateControlledOption(this.employmentType, jobOptions.employmentTypes, 'Employment type');
        validateControlledOption(this.experienceRequired, jobOptions.experienceLevels, 'Experience required');
        validateControlledOption(this.educationLevel, jobOptions.educationLevels, 'Education level');

        if (!isValidDateOnly(this.closingDate)) {
            throw new Error('Closing date must be a valid date.');
        }

        if (this.closingDate <= toLocalDateOnly(today)) {
            throw new Error('Closing date must be after today.');
        }
    }

    toJSON() {
        return { ...this };
    }
}

function normaliseSalary(value) {
    if (value === '' || value === null || value === undefined) return null;
    return typeof value === 'number' ? value : Number(String(value).trim());
}

function normaliseSkills(value) {
    const values = Array.isArray(value) ? value : String(value || '').split(',');
    return [...new Set(values
        .map(skill => canonicalOption(skill, jobOptions.skills))
        .filter(Boolean))];
}

function canonicalOption(value, options) {
    const trimmed = String(value || '').trim();
    return options.find(option => option.toLowerCase() === trimmed.toLowerCase()) || trimmed;
}

function validateControlledOption(value, options, label) {
    if (!options.includes(value)) {
        throw new Error(`${label} must be selected from the available options.`);
    }
}

function isValidDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function toLocalDateOnly(value) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fieldLabel(field) {
    return field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, character => character.toUpperCase());
}

module.exports = Job;
