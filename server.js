const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

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