const express = require('express');
const fs = require('fs');
const path = require('path');
const companyRoutes = require('./routes/companyRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));
app.use(companyRoutes);
app.use(jobRoutes);
app.use(applicationRoutes);

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

// Login API: POST /api/login
// Authenticates user and redirects based on role
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Email and password are required.'));
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user  = users.find(u => u.email === email);

    // Invalid email or wrong password
    if (!user || user.password !== 'hashed_' + password) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Invalid email or password.'));
    }

    // Redirect to the correct page based on the user's actual role
    if (user.role === 'Job Seeker') {
        return res.redirect(`/dashboard.html?userId=${user.id}`);
    }

    if (user.role === 'Employer') {
        return res.redirect(`/company-profile.html?employerId=${user.id}`);
    }

    // Fallback
    res.redirect('/dashboard.html');
});

// Task 3: Develop registration API route to validate fields and save data
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
        : `/dashboard.html?userId=${newUser.id}`;
    return response.redirect(nextPage);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running! Open your browser and go to http://localhost:${PORT}/register.html`);
    });
}

module.exports = app;
