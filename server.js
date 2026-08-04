const express = require('express');
const fs = require('fs');
const path = require('path');
const companyRoutes      = require('./routes/companyRoutes');
const applicationRoutes  = require('./routes/applicationRoutes');

const app = express();
const PORT = 3000;

// Paths to our JSON text file databases
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const JOBS_FILE  = path.join(__dirname, 'data', 'jobs.json');

// Middleware to read form submissions and serve HTML files automatically
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));
app.use(companyRoutes);
app.use(applicationRoutes);

// Task 2: Ensure database "schema" exists (initialize an empty array text file if it's missing)
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
app.post('/api/register', (encodeData, response) => {
    const { email, password, role } = encodeData.body;

    // 1. Read existing users from our text file
    const fileData = fs.readFileSync(USERS_FILE, 'utf8');
    const users = JSON.parse(fileData);

    // 2. Validation: Check if the user already exists
    const userExists = users.find(u => u.email === email);
    if (userExists) {
        return response.send('<h2>Error: This email is already registered!</h2><a href="/register.html">Go Back</a>');
    }

    // 3. Simple Hashing Alternative (Since we aren't using heavy libraries yet, let's prefix it to simulate hashing)
    const simulatedHashedPassword = "hashed_" + password;

    // 4. Create new user object matching our structured "schema"
    const newUser = {
        id: Date.now(), // unique ID
        email: email,
        password: simulatedHashedPassword,
        role: role
    };

    if (role === 'Employer') {
        newUser.companyId = null;
    }

    // 5. Save back to the JSON file
    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    // 6. Redirect based on role
    if (role === 'Employer') {
        response.redirect(`/company-profile.html?employerId=${newUser.id}`);
    } else {
        // Job Seeker: pass userId in URL so dashboard.html stores it in localStorage
        response.redirect(`/dashboard.html?userId=${newUser.id}`);
    }
});

// Job Search API: GET /api/jobs?q=<title query>
// Returns all jobs whose title contains the query string (case-insensitive)
app.get('/api/jobs', (req, res) => {
    const query = (req.query.q || '').trim().toLowerCase();

    // Read the jobs data file
    const jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));

    // Filter by title — partial, case-insensitive match.
    // If no query is provided, return all jobs.
    const results = query
        ? jobs.filter(job => job.title.toLowerCase().includes(query))
        : jobs;

    res.json(results);
});

// Start our web server
app.listen(PORT, () => {
    console.log(`Server running! Open your browser and go to http://localhost:${PORT}/register.html`);
});
