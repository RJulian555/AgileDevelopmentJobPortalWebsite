const express = require('express');
const fs = require('fs');
const path = require('path');
const companyRoutes = require('./routes/companyRoutes');

const app = express();
const PORT = 3000;

// Path to our JSON text file database
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Middleware to read form submissions and serve HTML files automatically
app.use(express.urlencoded({ extended: true }));
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

    // 5. Save back to the JSON file
    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    // 6. Success! Send them to their dashboard
    response.redirect('/dashboard.html');
});

// Start our web server
app.listen(PORT, () => {
    console.log(`Server running! Open your browser and go to http://localhost:${PORT}/register.html`);
});
