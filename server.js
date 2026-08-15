const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

let resetTokensMemory = {};

// ========== 中间件（顺序很重要） ==========
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '5mb' }));

// 静态文件服务（先于所有路由，确保能访问 HTML 文件）
app.use(express.static('public'));

// 确保 users.json 存在
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

// ========== 根路径重定向（解决 Cannot GET /） ==========
app.get('/', (req, res) => {
    res.redirect('/register.html');
});

// ========== 调试日志（帮你观察请求） ==========
app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

// ========== API 路由（放在所有外部路由之前） ==========
app.post('/api/login', (req, res) => {
    console.log('Body:', req.body);
    const { email, password, role } = req.body;

    if (!email || !password) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Email and password are required.'));
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.email === email);

    if (!user || user.password !== 'hashed_' + password) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Invalid email or password.'));
    }

    if (role && user.role !== role) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Account exists under a different role.'));
    }

    if (user.role === 'Job Seeker') {
        return res.redirect(`/dashboard.html?userId=${user.id}`);
    }
    if (user.role === 'Employer') {
        return res.redirect(`/company-profile.html?employerId=${user.id}`);
    }
    res.redirect('/dashboard.html');
});

app.post('/api/register', (req, res) => {
    const { email, password, role } = req.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (users.find(u => u.email === email)) {
        return res.send('<h2>Error: This email is already registered!</h2><a href="/register.html">Go Back</a>');
    }

    const defaultProfile = {
        fullName: '', jobTitle: '', location: '', phone: '', birthday: '',
        website: '', about: '', skillsText: '', languages: '', avatarSrc: ''
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
    if (role === 'Employer') newUser.companyId = null;

    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    const nextPage = role === 'Employer'
        ? `/company-profile.html?employerId=${newUser.id}`
        : `/dashboard.html?userId=${newUser.id}`;
    res.redirect(nextPage);
});

app.get('/api/profile', (req, res) => {
    const userId = parseInt(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

app.put('/api/profile', (req, res) => {
    const userId = parseInt(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return res.status(404).json({ error: 'User not found' });
    const incoming = req.body;
    const existing = users[index];
    if (incoming.profile) existing.profile = { ...existing.profile, ...incoming.profile };
    if (incoming.skills !== undefined) existing.skills = incoming.skills;
    if (incoming.work) existing.work = incoming.work;
    if (incoming.edu) existing.edu = incoming.edu;
    users[index] = existing;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
});

// =========================================================================
// 3. ADDED HERE: US-04 Forgot Password Endpoint (Connected to users.json)
// =========================================================================
app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;

    // Validation Check
    if (!email) {
        return res.status(400).json({ error: "Email address field is required." });
    }

    // Database Lookup from your real data/users.json file
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
        return res.status(404).json({ error: "No account registered with that email address." });
    }

    // Generate Secure Token & Expiry (Valid for 15 minutes)
    const secureToken = crypto.randomBytes(20).toString('hex');
    const expiryTime = Date.now() + 900000; 

    // Store token mapped directly to user email
    resetTokensMemory[secureToken] = {
        email: user.email,
        expires: expiryTime
    };

    // Output Mock Email Link directly to your running terminal log
    const mockResetLink = `http://localhost:3000/reset-password.html?token=${secureToken}`;
    console.log("==========================================");
    console.log(`MOCK EMAIL SENT TO: ${user.email}`);
    console.log(`RESET URL LINK: ${mockResetLink}`);
    console.log("==========================================");

    return res.status(200).json({ message: "Secure recovery token generated successfully." });
});

// =========================================================================
// 4. ADDED HERE: US-04 Complete Password Reset Action Endpoint
// =========================================================================
app.post('/api/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body;

    // 1. Validation Check: Ensure data is sent
    if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required." });
    }

    // 2. Token Check: Verify if token exists in memory
    const tokenData = resetTokensMemory[token];
    if (!tokenData) {
        return res.status(400).json({ error: "Invalid or expired password reset token." });
    }

    // 3. Expiry Check: Ensure the 15 minutes haven't passed
    if (Date.now() > tokenData.expires) {
        delete resetTokensMemory[token]; // Clean up expired token
        return res.status(400).json({ error: "This token has expired. Please request a new one." });
    }

    // 4. Update the Real Database
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const userIndex = users.findIndex(u => u.email.toLowerCase() === tokenData.email.toLowerCase());

    if (userIndex === -1) {
        return res.status(404).json({ error: "User account no longer exists." });
    }

    // Update password using your exact schema convention ("hashed_" prefix)
    users[userIndex].password = `hashed_${newPassword}`;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    // 5. Token Cleanup: Delete token so it can't be used twice
    delete resetTokensMemory[token];

    console.log(`🔒 PASSWORD UPDATED SUCCESSFULLY FOR: ${tokenData.email}`);
    return res.status(200).json({ message: "Your password has been successfully reset." });
});

// ========== 外部业务路由（挂载在根路径，但已包含 /api/*） ==========
const companyRoutes = require('./routes/companyRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

app.use(companyRoutes);
app.use(jobRoutes);
app.use(applicationRoutes);

// ========== 兜底 404（处理未匹配的 /api/* 请求） ==========
app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// ========== 全局错误处理 ==========
app.use((error, req, res, next) => {
    if (!req.path.startsWith('/api')) return next(error);
    const statusCode = error.status || error.statusCode || 500;
    const message = error instanceof SyntaxError && error.type === 'entity.parse.failed'
        ? 'The request body contains invalid JSON.'
        : 'The server could not process the API request.';
    res.status(statusCode).json({ error: message });
});

// ========== 启动服务器 ==========
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
        console.log(`📌 Visit: http://localhost:${PORT}/register.html`);
    });
}

module.exports = app;