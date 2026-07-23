const express = require('express');
const fs = require('fs');
const path = require('path');
const companyRoutes = require('./routes/companyRoutes');

const app = express();
const PORT = 3000;

// Paths to our JSON text file databases
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const JOBS_FILE  = path.join(__dirname, 'data', 'jobs.json');

// Middleware to read form submissions and serve HTML files automatically
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(companyRoutes);

// Task 2: Ensure database "schema" exists (initialize an empty array text file if it's missing)
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

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

    // 6. Employers create their company profile before continuing to the dashboard
    const nextPage = role === 'Employer'
        ? `/company-profile.html?employerId=${newUser.id}`
        : '/dashboard.html';
    response.redirect(nextPage);
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
