const express = require('express');
const { readCollection, writeCollection, ensureCollection } = require('../services/jsonDatabase');

const router = express.Router();

ensureCollection('applications');
ensureCollection('resumes');

// GET /api/applications?seekerId=<id>
// Returns array of jobIds the seeker has already applied to
router.get('/api/applications', (req, res) => {
    const { seekerId } = req.query;
    if (!seekerId) return res.status(400).json({ error: 'seekerId is required.' });

    const applications = readCollection('applications');
    const appliedJobIds = applications
        .filter(a => String(a.seekerId) === String(seekerId))
        .map(a => String(a.jobId));

    res.json(appliedJobIds);
});

// GET /api/applications/check?seekerId=<id>&jobId=<id>
// Returns { applied: true/false }
router.get('/api/applications/check', (req, res) => {
    const { seekerId, jobId } = req.query;
    if (!seekerId || !jobId) {
        return res.status(400).json({ error: 'seekerId and jobId are required.' });
    }

    const applications = readCollection('applications');
    const existing = applications.find(
        a => String(a.seekerId) === String(seekerId) && String(a.jobId) === String(jobId)
    );

    res.json({ applied: !!existing });
});

// POST /api/applications
// Validates user profile in users.json + resumes.json, checks duplicates, saves application
router.post('/api/applications', (req, res) => {
    const { seekerId, jobId } = req.body;

    if (!seekerId || !jobId) {
        return res.status(400).json({ error: 'seekerId and jobId are required.' });
    }

    // 1. Check job seeker has submitted profile form (has non-empty fullName in profile)
    const users = readCollection('users');
    const seeker = users.find(u => String(u.id) === String(seekerId) && u.role === 'Job Seeker');
    const isProfileComplete = seeker && seeker.profile && seeker.profile.fullName && seeker.profile.fullName.trim() !== '';

    if (!isProfileComplete) {
        return res.status(422).json({
            error: 'no_profile',
            message: 'Please complete your profile before applying.'
        });
    }

    // 2. Check resume has been uploaded in resumes.json
    const resumes = readCollection('resumes');
    const resumeEntry = resumes.find(r =>
        String(r.userId || r.user_id || r.seekerId) === String(seekerId)
    );
    const resumeUrl = resumeEntry
        ? (resumeEntry.resumeUrl || resumeEntry.resume_url || resumeEntry.resume_id || resumeEntry.resumeFilename || null)
        : null;

    if (!resumeUrl) {
        return res.status(422).json({
            error: 'no_resume',
            message: 'Please upload a resume before applying.'
        });
    }

    // 3. Check for duplicate application
    const applications = readCollection('applications');
    const duplicate = applications.find(
        a => String(a.seekerId) === String(seekerId) && String(a.jobId) === String(jobId)
    );
    if (duplicate) {
        return res.status(409).json({
            error: 'duplicate',
            message: 'You have already applied for this job.'
        });
    }

    // 4. Verify the job exists
    const jobs = readCollection('jobs');
    const job = jobs.find(j => String(j.id) === String(jobId));
    if (!job) {
        return res.status(404).json({ error: 'Job not found.' });
    }

    // 5. Save application
    const newApplication = {
        id: `app-${Date.now()}`,
        jobId:     String(jobId),
        seekerId:  String(seekerId),
        appliedAt: new Date().toISOString(),
        resumeUrl: String(resumeUrl)
    };

    applications.push(newApplication);
    writeCollection('applications', applications);

    res.status(201).json({ message: 'Application submitted successfully!' });
});

module.exports = router;
