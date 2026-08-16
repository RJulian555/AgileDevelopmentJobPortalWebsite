const express = require('express');
const { readCollection, writeCollection, ensureCollection } = require('../services/jsonDatabase');

const router = express.Router();

ensureCollection('applications');
ensureCollection('resumes');

// Education Rank Mapping
const EDU_RANKS = {
    'no formal qualification': 0,
    'spm / o-level': 1,
    'spm': 1,
    'o-level': 1,
    'high school': 1,
    'certificate': 2,
    'diploma': 3,
    "bachelor's degree": 4,
    'bachelor': 4,
    'degree': 4,
    "master's degree": 5,
    'master': 5,
    'doctorate': 6,
    'phd': 6
};

function getRequiredEduRank(jobEdu) {
    if (!jobEdu) return 0;
    const lower = String(jobEdu).toLowerCase();
    for (const [key, rank] of Object.entries(EDU_RANKS)) {
        if (lower.includes(key)) return rank;
    }
    return 0;
}

function getSeekerHighestEduRank(seeker) {
    if (!seeker || !Array.isArray(seeker.edu) || seeker.edu.length === 0) return { rank: 0, label: 'No Formal Education Listed' };
    let maxRank = 0;
    let highestEduLabel = seeker.edu[0].major || seeker.edu[0].school || 'Education Listed';

    seeker.edu.forEach(item => {
        const text = `${item.major || ''} ${item.school || ''} ${item.desc || ''}`.toLowerCase();
        for (const [key, rank] of Object.entries(EDU_RANKS)) {
            if (text.includes(key)) {
                if (rank > maxRank) {
                    maxRank = rank;
                    highestEduLabel = item.major || item.school || key;
                }
            }
        }
    });

    if (maxRank === 0 && seeker.edu.length > 0) {
        maxRank = 3;
    }

    return { rank: maxRank, label: highestEduLabel };
}

function getRequiredMinYears(jobExp) {
    if (!jobExp) return 0;
    const lower = String(jobExp).toLowerCase();
    if (lower.includes('no experience') || lower.includes('internship') || lower.includes('less than 1')) return 0;
    if (lower.includes('1-2') || lower.includes('1 year')) return 1;
    if (lower.includes('3-5')) return 3;
    if (lower.includes('6-8')) return 6;
    if (lower.includes('9-10')) return 9;
    if (lower.includes('more than 10') || lower.includes('10+')) return 10;
    return 0;
}

function calculateSeekerExperienceYears(seeker) {
    if (!seeker || !Array.isArray(seeker.work) || seeker.work.length === 0) return 0;
    let totalMonths = 0;

    seeker.work.forEach(item => {
        const start = item.start ? new Date(item.start) : null;
        const end = item.end ? new Date(item.end) : new Date();

        if (start && !isNaN(start.getTime())) {
            const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            if (months > 0) totalMonths += months;
        }
    });

    return Math.round((totalMonths / 12) * 10) / 10;
}

// Helper to compute complete requirements match fit (Skills + Experience Years + Education Level)
function calculateRequirementsFit(seeker, job) {
    // 1. SKILLS
    const requiredSkills = Array.isArray(job.skillsRequired)
        ? job.skillsRequired
        : (Array.isArray(job.skills) ? job.skills : []);

    let seekerSkills = [];
    if (seeker) {
        if (Array.isArray(seeker.skills)) seekerSkills = seekerSkills.concat(seeker.skills);
        if (seeker.profile && typeof seeker.profile.skills === 'string') {
            const parsed = seeker.profile.skills.split(',').map(s => s.trim()).filter(Boolean);
            seekerSkills = seekerSkills.concat(parsed);
        }
    }

    const lowerSeekerSkills = seekerSkills.map(s => String(s).toLowerCase());
    const matchedSkills = [];
    const missingSkills = [];

    requiredSkills.forEach(reqSkill => {
        if (lowerSeekerSkills.includes(String(reqSkill).toLowerCase())) {
            matchedSkills.push(reqSkill);
        } else {
            missingSkills.push(reqSkill);
        }
    });

    // 2. EXPERIENCE
    const requiredExperience = job.experienceRequired || 'No experience required';
    const minYearsRequired = getRequiredMinYears(requiredExperience);
    const candidateYears = calculateSeekerExperienceYears(seeker);
    const experienceMatched = candidateYears >= minYearsRequired;

    // 3. EDUCATION
    const requiredEducation = job.educationLevel || 'No formal qualification';
    const reqEduRank = getRequiredEduRank(requiredEducation);
    const seekerEduInfo = getSeekerHighestEduRank(seeker);
    const educationMatched = seekerEduInfo.rank >= reqEduRank;

    // TOTAL POINTS
    let totalItems = requiredSkills.length;
    let passedItems = matchedSkills.length;

    if (job.experienceRequired && requiredExperience !== 'No experience required') {
        totalItems += 1;
        if (experienceMatched) passedItems += 1;
    }

    if (job.educationLevel && requiredEducation !== 'No formal qualification') {
        totalItems += 1;
        if (educationMatched) passedItems += 1;
    }

    const matchPercentage = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 100;

    let fitStatus = 'Meets Requirements';
    if (totalItems > 0) {
        if (matchPercentage === 100) {
            fitStatus = 'Meets Requirements';
        } else if (matchPercentage >= 50) {
            fitStatus = 'Partial Match';
        } else {
            fitStatus = 'Below Requirements';
        }
    }

    const allMissingRequirements = [...missingSkills];
    if (job.experienceRequired && requiredExperience !== 'No experience required' && !experienceMatched) {
        allMissingRequirements.push(`Experience: ${requiredExperience} required (${candidateYears} yrs current)`);
    }
    if (job.educationLevel && requiredEducation !== 'No formal qualification' && !educationMatched) {
        allMissingRequirements.push(`Education: ${requiredEducation} required (${seekerEduInfo.label || 'lower'})`);
    }

    return {
        matchedSkills,
        missingSkills,
        experience: {
            required: requiredExperience,
            candidateYears,
            matched: experienceMatched
        },
        education: {
            required: requiredEducation,
            candidateEduLabel: seekerEduInfo.label,
            matched: educationMatched
        },
        allMissingRequirements,
        matchPercentage,
        fitStatus,
        requiredSkills
    };
}

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

// GET /api/employer/applications?employerId=<id>
// Retrieves applicants for jobs posted by the employer's company, with full fit scoring (skills + experience + education)
router.get('/api/employer/applications', (req, res) => {
    const employerId = req.query.employerId;
    if (!employerId) {
        return res.status(400).json({ error: 'employerId is required.' });
    }

    const users = readCollection('users');
    const employer = users.find(u => String(u.id) === String(employerId) && u.role === 'Employer');
    if (!employer || !employer.companyId) {
        return res.status(403).json({ error: 'Employer must belong to a company to view applicants.' });
    }

    const jobs = readCollection('jobs').filter(j => String(j.companyId) === String(employer.companyId));
    const companyJobIds = jobs.map(j => String(j.id));

    const applications = readCollection('applications');
    const companyApplications = applications.filter(a => companyJobIds.includes(String(a.jobId)));

    const enrichedApplications = companyApplications.map(app => {
        const job = jobs.find(j => String(j.id) === String(app.jobId));
        const seeker = users.find(u => String(u.id) === String(app.seekerId));

        const fit = calculateRequirementsFit(seeker, job || {});

        return {
            id: app.id,
            jobId: app.jobId,
            jobTitle: job ? job.title : 'Unknown Job',
            companyId: employer.companyId,
            seekerId: app.seekerId,
            seekerName: (seeker && seeker.profile && seeker.profile.fullName) || 'Applicant',
            seekerEmail: seeker ? seeker.email : '',
            seekerJobTitle: (seeker && seeker.profile && seeker.profile.jobTitle) || '',
            seekerLocation: (seeker && seeker.profile && seeker.profile.location) || '',
            appliedAt: app.appliedAt,
            resumeUrl: app.resumeUrl,
            status: app.status || 'pending',
            fit: fit
        };
    });

    res.json(enrichedApplications);
});

// PATCH /api/applications/:id/status
// Allows employer to accept or reject an applicant
router.patch('/api/applications/:id/status', (req, res) => {
    const { id } = req.params;
    const { employerId, status } = req.body;

    if (!employerId || !status) {
        return res.status(400).json({ error: 'employerId and status are required.' });
    }

    if (!['accepted', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Status must be accepted, rejected, or pending.' });
    }

    const users = readCollection('users');
    const employer = users.find(u => String(u.id) === String(employerId) && u.role === 'Employer');
    if (!employer || !employer.companyId) {
        return res.status(403).json({ error: 'Employer must belong to a company to manage applicants.' });
    }

    const applications = readCollection('applications');
    const appIndex = applications.findIndex(a => String(a.id) === String(id));
    if (appIndex === -1) {
        return res.status(404).json({ error: 'Application not found.' });
    }

    const targetApp = applications[appIndex];
    const jobs = readCollection('jobs');
    const job = jobs.find(j => String(j.id) === String(targetApp.jobId));

    if (!job || String(job.companyId) !== String(employer.companyId)) {
        return res.status(403).json({ error: 'You are not authorized to update applications for this job.' });
    }

    applications[appIndex].status = status;
    writeCollection('applications', applications);

    const message = status === 'accepted'
        ? 'Applicant accepted successfully!'
        : `Applicant status set to ${status}.`;

    res.json({
        message,
        application: applications[appIndex]
    });
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

    // 5. Save application with status = pending
    const newApplication = {
        id: `app-${Date.now()}`,
        jobId:     String(jobId),
        seekerId:  String(seekerId),
        appliedAt: new Date().toISOString(),
        resumeUrl: String(resumeUrl),
        status:    'pending'
    };

    applications.push(newApplication);
    writeCollection('applications', applications);

    res.status(201).json({ message: 'Application submitted successfully!' });
});

module.exports = router;
