const request = require('supertest');
const app = require('../server'); // Fixed path: pointing up one folder to find your server
const fs = require('fs');
const path = require('path');

// Fixed path: targets your data folder correctly from within the test folder
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

describe('US-04: Password Reset Loop Automated Validation Tests', () => {
    
    beforeAll(() => {
        // Safe check to make sure mock data directory structure exists
        if (!fs.existsSync(path.dirname(USERS_FILE))) {
            fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
        }
    });

    // ==========================================
    // 1. HAPPY PATH TEST (Valid Input)
    // ==========================================
    it('should return 200 Success when a valid registered email is submitted', async () => {
        // Let's seed a temporary user specifically for this test run
        const originalData = fs.existsSync(USERS_FILE) ? fs.readFileSync(USERS_FILE, 'utf8') : '[]';
        const users = JSON.parse(originalData);
        
        if(!users.some(u => u.email === 'test_ryan@example.com')) {
            users.push({ id: 99999, email: "test_ryan@example.com", password: "oldpassword123" });
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        }

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'test_ryan@example.com' }); 

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message');
    });

    // ==========================================
    // 2. NEGATIVE PATH TEST (Invalid Input - Missing Field)
    // ==========================================
    it('should return 400 Bad Request when the email field is left empty', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: '' }); 

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error');
    });

    // ==========================================
    // 3. NEGATIVE PATH TEST (Invalid Input - Unregistered Account)
    // ==========================================
    it('should return 404 Not Found when an unregistered email is submitted', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'notregistered_email@gmail.com' }); 

        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error');
    });
});