const express = require('express');
const fs = require('fs');
const path = require('path');
const companyRoutes = require('./routes/companyRoutes');
const jobRoutes = require('./routes/jobRoutes');

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(companyRoutes);
app.use(jobRoutes);

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

app.post('/api/register', (request, response) => {
    const { email, password, role } = request.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const userExists = users.find(user => user.email === email);

    if (userExists) {
        return response.send('<h2>Error: This email is already registered!</h2><a href="/register.html">Go Back</a>');
    }

    const newUser = {
        id: Date.now(),
        email,
        password: `hashed_${password}`,
        role
    };

    if (role === 'Employer') {
        newUser.companyId = null;
    }

    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    const nextPage = role === 'Employer'
        ? `/company-profile.html?employerId=${newUser.id}`
        : '/dashboard.html';
    return response.redirect(nextPage);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running! Open your browser and go to http://localhost:${PORT}/register.html`);
    });
}

module.exports = app;
