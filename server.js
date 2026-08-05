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
    const { email, password, role } = req.body;

    if (!email || !password) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Email and password are required.'));
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.email === email);

    // Invalid email or wrong password
    if (!user || user.password !== 'hashed_' + password) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Invalid email or password.'));
    }

    // Role mismatch: account exists but under a different role
    if (role && user.role !== role) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Account exists under a different role.'));
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

    const defaultProfile = {
        fullName: '', jobTitle: '', location: '', phone: '', birthday: '', website: '', about: '', skillsText: '', languages: '', avatarSrc: ''
    };

    const newUser = {
        id: Date.now(),
        email,
        password: `hashed_${password}`,
        role,
        profile: { ...defaultProfile },
        skills: [],
        work: [],
        edu: []
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

// Profile API: GET /api/profile
app.get('/api/profile', (req, res) => {
    const userId = parseInt(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'Missing userId parameter' });

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

// Profile API: PUT /api/profile
app.put('/api/profile', (req, res) => {
    const userId = parseInt(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'Missing userId parameter' });

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return res.status(404).json({ error: 'User not found' });

    const incoming = req.body;
    const existing = users[index];
    if (incoming.profile) {
        existing.profile = { ...existing.profile, ...incoming.profile };
    }
    if (incoming.skills !== undefined) existing.skills = incoming.skills;
    if (incoming.work) existing.work = incoming.work;
    if (incoming.edu) existing.edu = incoming.edu;

    users[index] = existing;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
});

// API clients always expect JSON. Keep Express's default HTML 404/error pages
// from being passed to fetch callers that will try to parse them as JSON.
app.use('/api', (request, response) => {
    return response.status(404).json({
        error: `API route not found: ${request.method} ${request.originalUrl}`
    });
});

app.use((error, request, response, next) => {
    if (!request.path.startsWith('/api')) return next(error);

    const statusCode = error.status || error.statusCode || 500;
    const message = error instanceof SyntaxError && error.type === 'entity.parse.failed'
        ? 'The request body contains invalid JSON.'
        : 'The server could not process the API request.';

    return response.status(statusCode).json({ error: message });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running! Open your browser and go to http://localhost:${PORT}/register.html`);
    });
}

module.exports = app;
