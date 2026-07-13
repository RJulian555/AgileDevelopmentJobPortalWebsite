class Employer {
    constructor({ id, email, companyId = null }) {
        if (!id) throw new Error('Employer id is required.');
        if (!email) throw new Error('Employer email is required.');

        this.id = id;
        this.email = email.trim().toLowerCase();
        this.companyId = companyId || null;
    }

    static fromUser(user) {
        if (user.role !== 'Employer') {
            throw new Error('Only a user with the Employer role can be an Employer entity.');
        }

        return new Employer(user);
    }

    joinCompany(companyId) {
        if (!companyId) throw new Error('A company id is required.');
        this.companyId = companyId;
        return this;
    }
}

module.exports = Employer;
