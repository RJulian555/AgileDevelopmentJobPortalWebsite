const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

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

// ========== Inbox System ==========
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

// ✅ 辅助函数：安全读取 messages.json
function readMessagesFile() {
    try {
        if (!fs.existsSync(MESSAGES_FILE)) {
            fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        if (!data || data.trim() === '') {
            fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
            return [];
        }
        return JSON.parse(data);
    } catch (e) {
        console.warn('Failed to parse messages.json, resetting to empty array:', e.message);
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
        return [];
    }
}

// ✅ 辅助函数：安全写入 messages.json
function writeMessagesFile(messages) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// 确保 messages.json 存在且格式正确
if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
} else {
    try {
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        if (!data || data.trim() === '') {
            fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
        } else {
            JSON.parse(data);
        }
    } catch (e) {
        console.warn('Invalid messages.json, resetting to empty array');
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
    }
}

// 获取用户收件箱（通过 email）
app.get('/api/inbox', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    try {
        const messages = readMessagesFile();
        const userMessages = messages
            .filter(m => m.receiverEmail === email)
            .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

        const unreadCount = userMessages.filter(m => !m.read).length;
        res.json({ inbox: userMessages, unreadCount });
    } catch (e) {
        res.status(500).json({ error: 'Failed to read messages: ' + e.message });
    }
});

// ✅ 通过 userId 获取收件箱（无需 email）
app.get('/api/inbox/by-user', (req, res) => {
    const userId = parseInt(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    try {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        const user = users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const email = user.email;
        const messages = readMessagesFile();
        const userMessages = messages
            .filter(m => m.receiverEmail === email)
            .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

        const unreadCount = userMessages.filter(m => !m.read).length;
        res.json({ inbox: userMessages, unreadCount, userEmail: email });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load inbox: ' + e.message });
    }
});

// 获取未读消息数量（用于 Dashboard 红点）
app.get('/api/inbox/unread', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    try {
        const messages = readMessagesFile();
        const unreadCount = messages.filter(m => m.receiverEmail === email && !m.read).length;
        res.json({ unreadCount });
    } catch (e) {
        res.status(500).json({ error: 'Failed to read messages' });
    }
});

// 发送消息到邮箱
app.post('/api/inbox/send', (req, res) => {
    const { senderEmail, receiverEmail, subject, content, attachment } = req.body;

    if (!senderEmail || !receiverEmail || !subject) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        const receiver = users.find(u => u.email === receiverEmail);
        if (!receiver) {
            return res.status(404).json({ error: 'User with this email not found' });
        }

        const sender = users.find(u => u.email === senderEmail);
        const senderName = sender?.profile?.fullName || senderEmail;

        const newMessage = {
            id: `msg_${Date.now()}`,
            senderEmail: senderEmail,
            senderName: senderName,
            receiverEmail: receiverEmail,
            subject: subject,
            content: content || '',
            attachment: attachment || null,
            read: false,
            sentAt: new Date().toISOString()
        };

        const messages = readMessagesFile();
        messages.push(newMessage);
        writeMessagesFile(messages);

        res.json({
            success: true,
            message: `Message sent to ${receiverEmail}`,
            data: newMessage
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to send message: ' + e.message });
    }
});

// 标记消息为已读
app.patch('/api/inbox/:messageId/read', (req, res) => {
    const messageId = req.params.messageId;
    try {
        const messages = readMessagesFile();
        const message = messages.find(m => m.id === messageId);
        
        if (message) {
            message.read = true;
            writeMessagesFile(messages);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Message not found' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// ========== PDF Generation ==========

// ✅ escapeHtml 函数（防止 XSS 攻击）
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 构建简历 HTML
function buildResumeHTML(data) {
    const { fullName, jobTitle, email, phone, location, about, skills, languages, work, edu } = data;
    
    const workHtml = (work || []).map(w => `
        <div class="entry">
            <div class="entry-header">
                <span class="entry-title">${escapeHtml(w.position || 'Position')}</span>
                <span class="entry-company">${escapeHtml(w.company || 'Company')}</span>
            </div>
            <div class="entry-date">${escapeHtml(w.start || '')} ${w.start && w.end ? '–' : ''} ${escapeHtml(w.end || '')}</div>
            ${w.desc ? `<div class="entry-desc">${escapeHtml(w.desc)}</div>` : ''}
        </div>
    `).join('');

    const eduHtml = (edu || []).map(e => `
        <div class="entry">
            <div class="entry-header">
                <span class="entry-title">${escapeHtml(e.school || 'School')}</span>
            </div>
            <div class="entry-major">${escapeHtml(e.major || 'Major')}</div>
            <div class="entry-date">${escapeHtml(e.start || '')} ${e.start && e.end ? '–' : ''} ${escapeHtml(e.end || '')}</div>
        </div>
    `).join('');

    const skillsHtml = skills ? skills.split(',').map(s => 
        `<span class="skill-tag">${escapeHtml(s.trim())}</span>`
    ).join('') : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Resume - ${escapeHtml(fullName)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #2c3e50; }
        .header { border-bottom: 3px solid #2ecc71; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 24px; }
        .header h1 { font-size: 28px; color: #2c3e50; margin: 0; }
        .header .position { font-size: 18px; color: #2ecc71; font-weight: 600; margin-top: 4px; }
        .body { display: flex; gap: 30px; }
        .left { flex: 0 0 30%; min-width: 200px; }
        .right { flex: 1; }
        .section { margin-bottom: 18px; }
        .section h3 { font-size: 14px; color: #2c3e50; border-bottom: 2px solid #2ecc71; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .item { font-size: 12px; padding: 4px 0; color: #34495e; line-height: 1.6; }
        .item strong { color: #2c3e50; }
        .entry { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #ecf0f1; }
        .entry:last-child { border-bottom: none; }
        .entry-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; margin-bottom: 2px; }
        .entry-title { font-size: 14px; font-weight: 700; color: #2c3e50; }
        .entry-company { font-size: 13px; font-weight: 600; color: #2ecc71; }
        .entry-date { font-size: 11px; color: #7f8c8d; text-align: right; }
        .entry-desc { font-size: 12px; color: #34495e; margin-top: 4px; line-height: 1.5; }
        .entry-major { font-size: 13px; font-weight: 600; color: #2c3e50; margin-top: 2px; }
        .skill-tag { background: #eef9f2; color: #2ecc71; padding: 2px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid #2ecc71; display: inline-block; margin: 3px 4px 3px 0; }
        .resume-about { font-size: 12px; color: #34495e; line-height: 1.6; }
        @media print { body { padding: 20px; } }
        @media (max-width: 700px) { .body { flex-direction: column; } .left { flex: 1; } }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>${escapeHtml(fullName)}</h1>
            <div class="position">${escapeHtml(jobTitle || 'Position')}</div>
        </div>
    </div>
    <div class="body">
        <div class="left">
            <div class="section">
                <h3>Contact</h3>
                ${location ? `<div class="item"><strong>Address:</strong> ${escapeHtml(location)}</div>` : ''}
                ${email ? `<div class="item"><strong>Email:</strong> ${escapeHtml(email)}</div>` : ''}
                ${phone ? `<div class="item"><strong>Phone:</strong> ${escapeHtml(phone)}</div>` : ''}
                ${languages ? `<div class="item"><strong>Languages:</strong> ${escapeHtml(languages)}</div>` : ''}
            </div>
        </div>
        <div class="right">
            ${about ? `
            <div class="section">
                <h3>About Me</h3>
                <div class="resume-about">${escapeHtml(about)}</div>
            </div>
            ` : ''}
            ${skills ? `
            <div class="section">
                <h3>Skills</h3>
                <div>${skillsHtml}</div>
            </div>
            ` : ''}
            ${workHtml ? `
            <div class="section">
                <h3>Work Experience</h3>
                ${workHtml}
            </div>
            ` : ''}
            ${eduHtml ? `
            <div class="section">
                <h3>Education</h3>
                ${eduHtml}
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
}

// 生成 PDF API
app.post('/api/generate-pdf', async (req, res) => {
    const { userId, fullName, jobTitle, email, phone, location, about, skills, languages, work, edu } = req.body;

    if (!userId || !fullName) {
        return res.status(400).json({ error: 'userId and fullName are required' });
    }

    try {
        const html = buildResumeHTML({ fullName, jobTitle, email, phone, location, about, skills, languages, work, edu });

        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
        });
        await browser.close();

        const filename = `profile_${userId}_${Date.now()}.pdf`;
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, pdfBuffer);

        res.json({
            success: true,
            pdfUrl: `/uploads/${filename}`
        });
    } catch (e) {
        console.error('PDF generation error:', e);
        res.status(500).json({ error: 'Failed to generate PDF: ' + e.message });
    }
});

// ========== Profile Preview API（返回渲染好的 HTML，用于预览） ==========
app.post('/api/preview-profile', (req, res) => {
    const { fullName, jobTitle, email, phone, location, about, skills, languages, work, edu } = req.body;

    if (!fullName) {
        return res.status(400).json({ error: 'fullName is required' });
    }

    try {
        const html = buildResumeHTML({ fullName, jobTitle, email, phone, location, about, skills, languages, work, edu });
        res.send(html);
    } catch (e) {
        res.status(500).json({ error: 'Failed to generate preview: ' + e.message });
    }
});

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