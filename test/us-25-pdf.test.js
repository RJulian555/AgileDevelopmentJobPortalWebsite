const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const MESSAGES_FILE = path.join(__dirname, '..', 'data', 'messages.json');

// 测试套件
test('US-25: Export Profile to PDF', async (t) => {
    // 准备测试数据
    const testUsers = [
        {
            id: 1001,
            email: 'ali123@gmail.com',
            password: 'hashed_123456',
            role: 'Job Seeker',
            profile: {
                fullName: 'Ali Bin Ahmad',
                jobTitle: 'Software Engineer',
                location: 'Kuala Lumpur',
                phone: '+60 12 345 6789',
                birthday: '1995-06-15',
                website: '',
                about: 'Passionate software engineer.',
                skills: 'JavaScript, React, Node.js',
                languages: 'Malay, English',
                avatarSrc: ''
            },
            skills: ['JavaScript', 'React', 'Node.js'],
            work: [
                { company: 'Tech Solutions', position: 'Senior Developer', start: '2021-01', end: '2024-01', desc: 'Led a team of 5 developers.' }
            ],
            edu: [
                { school: 'University of Malaya', major: 'Computer Science', start: '2015-09', end: '2019-06', desc: 'CGPA: 3.8' }
            ]
        },
        {
            id: 1002,
            email: 'bli123@gmail.com',
            password: 'hashed_123456',
            role: 'Employer',
            profile: { fullName: 'Bli Tan', jobTitle: 'HR Manager', location: 'Petaling Jaya', phone: '+60 16 789 0123', birthday: '1988-03-20', website: '', about: '', skills: '', languages: 'Malay, English, Mandarin', avatarSrc: '' },
            skills: [],
            work: [],
            edu: []
        }
    ];

    // 备份原始数据
    let usersBackup = '';
    let messagesBackup = '';
    if (fs.existsSync(USERS_FILE)) usersBackup = fs.readFileSync(USERS_FILE, 'utf8');
    if (fs.existsSync(MESSAGES_FILE)) messagesBackup = fs.readFileSync(MESSAGES_FILE, 'utf8');

    // 写入测试数据
    fs.writeFileSync(USERS_FILE, JSON.stringify(testUsers, null, 2));
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));

    // 测试结束后恢复
    t.after(() => {
        if (usersBackup) fs.writeFileSync(USERS_FILE, usersBackup);
        if (messagesBackup) fs.writeFileSync(MESSAGES_FILE, messagesBackup);
    });

    // ================================================================
    // SC1: 导出 PDF
    // ================================================================
    await t.test('SC1: Should generate PDF successfully', async () => {
        const response = await request(app)
            .post('/api/generate-pdf')
            .send({
                userId: 1001,
                fullName: 'Ali Bin Ahmad',
                jobTitle: 'Software Engineer',
                email: 'ali123@gmail.com',
                phone: '+60 12 345 6789',
                location: 'Kuala Lumpur',
                about: 'Passionate software engineer.',
                skills: 'JavaScript, React, Node.js',
                languages: 'Malay, English',
                work: testUsers[0].work,
                edu: testUsers[0].edu
            });

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.success, true);
        assert.ok(response.body.pdfUrl.startsWith('/uploads/profile_'));
        assert.ok(response.body.pdfUrl.endsWith('.pdf'));

        // 验证 PDF 文件确实存在
        const pdfPath = path.join(__dirname, '..', 'public', response.body.pdfUrl);
        assert.ok(fs.existsSync(pdfPath));
        const stats = fs.statSync(pdfPath);
        assert.ok(stats.size > 1000); // 至少 1KB
    });

    await t.test('SC1: Should reject when fullName missing', async () => {
        const response = await request(app)
            .post('/api/generate-pdf')
            .send({ userId: 1001, fullName: '' });

        assert.strictEqual(response.status, 400);
        assert.ok(response.body.error.includes('fullName'));
    });

    // ================================================================
    // SC2: 发送到 Gmail
    // ================================================================
    await t.test('SC2: Should send PDF to valid Gmail address', async () => {
        const response = await request(app)
            .post('/api/inbox/send')
            .send({
                senderEmail: 'ali123@gmail.com',
                receiverEmail: 'bli123@gmail.com',
                subject: 'Ali Bin Ahmad shared their profile with you (PDF)',
                content: '📋 Profile Shared\n\nName: Ali Bin Ahmad',
                attachment: '/uploads/test.pdf'
            });

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.success, true);
        assert.ok(response.body.message.includes('bli123@gmail.com'));
    });

    await t.test('SC2: Should reject when receiver not found', async () => {
        const response = await request(app)
            .post('/api/inbox/send')
            .send({
                senderEmail: 'ali123@gmail.com',
                receiverEmail: 'fake@gmail.com',
                subject: 'Test',
                content: 'Test',
                attachment: '/uploads/test.pdf'
            });

        assert.strictEqual(response.status, 404);
        assert.ok(response.body.error.includes('not found'));
    });

    // ================================================================
    // SC3: 接收者查看
    // ================================================================
    await t.test('SC3: Recipient should see message in inbox', async () => {
        // 先发送消息
        await request(app)
            .post('/api/inbox/send')
            .send({
                senderEmail: 'ali123@gmail.com',
                receiverEmail: 'bli123@gmail.com',
                subject: 'Test Subject',
                content: 'Test Content',
                attachment: '/uploads/test.pdf'
            });

        const response = await request(app)
            .get('/api/inbox?email=bli123@gmail.com');

        assert.strictEqual(response.status, 200);
        assert.ok(Array.isArray(response.body.inbox));
        assert.ok(response.body.inbox.length > 0);
        const msg = response.body.inbox.find(m => m.subject === 'Test Subject');
        assert.ok(msg);
        assert.strictEqual(msg.senderEmail, 'ali123@gmail.com');
        assert.strictEqual(msg.attachment, '/uploads/test.pdf');
        assert.strictEqual(msg.read, false);
        assert.ok(response.body.unreadCount > 0);
    });

    await t.test('SC3: Recipient can mark message as read', async () => {
        // 发送消息
        const sendRes = await request(app)
            .post('/api/inbox/send')
            .send({
                senderEmail: 'ali123@gmail.com',
                receiverEmail: 'bli123@gmail.com',
                subject: 'Read Test',
                content: 'Content',
                attachment: '/uploads/test.pdf'
            });
        const msgId = sendRes.body.data.id;

        // 标记已读
        const readRes = await request(app)
            .patch(`/api/inbox/${msgId}/read`);

        assert.strictEqual(readRes.status, 200);
        assert.strictEqual(readRes.body.success, true);

        // 验证已读
        const inboxRes = await request(app)
            .get('/api/inbox?email=bli123@gmail.com');
        const msg = inboxRes.body.inbox.find(m => m.id === msgId);
        assert.strictEqual(msg.read, true);
    });

    // ================================================================
    // 预览功能
    // ================================================================
    await t.test('Preview: Should generate preview HTML', async () => {
        const response = await request(app)
            .post('/api/preview-profile')
            .send({
                fullName: 'Ali Bin Ahmad',
                jobTitle: 'Software Engineer',
                email: 'ali123@gmail.com',
                phone: '+60 12 345 6789',
                location: 'Kuala Lumpur',
                about: 'Passionate software engineer.',
                skills: 'JavaScript, React, Node.js',
                languages: 'Malay, English',
                work: testUsers[0].work,
                edu: testUsers[0].edu
            });

        assert.strictEqual(response.status, 200);
        assert.ok(response.text.includes('<!DOCTYPE html>'));
        assert.ok(response.text.includes('Ali Bin Ahmad'));
        assert.ok(response.text.includes('Software Engineer'));
        assert.ok(response.text.includes('Tech Solutions'));
        assert.ok(response.text.includes('University of Malaya'));
    });

    await t.test('Preview: Should reject when fullName missing', async () => {
        const response = await request(app)
            .post('/api/preview-profile')
            .send({ email: 'ali123@gmail.com' });

        assert.strictEqual(response.status, 400);
        assert.ok(response.body.error.includes('fullName'));
    });
});