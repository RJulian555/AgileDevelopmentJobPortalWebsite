const express = require('express');
const { readCollection, writeCollection, ensureCollection } = require('../services/jsonDatabase');

const router = express.Router();

ensureCollection('applications');
ensureCollection('job_seekers');
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
// Validates profile (job_seekers.json) + resume (resumes.json) exist, checks for duplicates, saves application
router.post('/api/applications', (req, res) => {
    const { seekerId, jobId } = req.body;

    if (!seekerId || !jobId) {
        return res.status(400).json({ error: 'seekerId and jobId are required.' });
    }

    // 1. Check job seeker profile record exists in job_seekers.json
    const jobSeekers = readCollection('job_seekers');
    const seeker = jobSeekers.find(s => String(s.user_id || s.userId || s.id || s.seekerId) === String(seekerId));
    if (!seeker) {
        return res.status(422).json({
            error: 'no_profile',
            message: 'Please complete your profile before applying.'
        });
    }

    // 2. Check resume has been uploaded in resumes.json
    const resumes = readCollection('resumes');
    const resumeEntry = resumes.find(r => String(r.user_id || r.userId || r.seekerId) === String(seekerId));
    const resumeUrl = resumeEntry ? (resumeEntry.resume_url || resumeEntry.resumeUrl || resumeEntry.resume_id || resumeEntry.resumeFilename) : null;

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
        jobId: String(jobId),
        seekerId: String(seekerId),
        appliedAt: new Date().toISOString(),
        resumeUrl: String(resumeUrl)
    };

    applications.push(newApplication);
    writeCollection('applications', applications);

    res.status(201).json({ message: 'Application submitted successfully!' });
});

module.exports = router;
