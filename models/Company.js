class Company {
    constructor({
        id,
        name,
        description = '',
        industry,
        address,
        email,
        phone,
        website = '',
        logoUrl = '',
        createdAt = new Date().toISOString(),
        updatedAt = createdAt
    }) {
        this.id = id;
        this.name = name?.trim();
        this.description = description?.trim() || '';
        this.industry = industry?.trim();
        this.address = address?.trim();
        this.email = email?.trim().toLowerCase();
        this.phone = phone?.trim();
        this.website = website?.trim() || '';
        this.logoUrl = logoUrl?.trim() || '';
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;

        this.validate();
    }

    validate() {
        const requiredFields = ['id', 'name', 'industry', 'address', 'email', 'phone'];
        const missingField = requiredFields.find(field => !this[field]);

        if (missingField) {
            throw new Error(`Company ${missingField} is required.`);
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            throw new Error('Company email must be valid.');
        }

        if (this.website) {
            try {
                const url = new URL(this.website);
                if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
            } catch {
                throw new Error('Company website must be a valid HTTP or HTTPS URL.');
            }
        }
    }

    toJSON() {
        return { ...this };
    }
}

module.exports = Company;
