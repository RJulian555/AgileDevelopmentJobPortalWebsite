const defaultDatabase = require('./jsonDatabase');

class ApplicantServiceError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'ApplicantServiceError';
        this.statusCode = statusCode;
    }
}

function sameId(left, right) {
    return String(left) === String(right);
}

function requireOwnedJob(jobId, employerId, database) {
    if (!employerId) {
        throw new ApplicantServiceError('employerId is required.', 400);
    }

    const job = database.readCollection('jobs').find(record => sameId(record.id, jobId));
    if (!job) {
        throw new ApplicantServiceError('Job opening not found.', 404);
    }

    if (!sameId(job.createdByEmployerId, employerId)) {
        throw new ApplicantServiceError('You can only view applicants for your own job openings.', 403);
    }

    return job;
}

function safeResumeUrl(value) {
    const url = String(value || '').trim();
    if (!url || /^javascript:/i.test(url)) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
    return `/${url.replace(/^\.\//, '')}`;
}

function findResume(application, seekerId, resumes) {
    const storedResume = resumes.find(record =>
        sameId(record.userId || record.user_id || record.seekerId, seekerId)
    );

    return safeResumeUrl(
        application.resumeUrl
        || storedResume?.resumeUrl
        || storedResume?.resume_url
        || storedResume?.resumeFilename
        || storedResume?.resume_id
    );
}

function applicantRecord(application, users, resumes) {
    const seeker = users.find(user =>
        sameId(user.id, application.seekerId) && user.role === 'Job Seeker'
    );

    if (!seeker) return null;

    const profile = seeker.profile || {};
    const profileSkills = profile.skills || profile.skillsText || '';
    const skills = Array.isArray(seeker.skills)
        ? seeker.skills
        : String(profileSkills).split(',').map(skill => skill.trim()).filter(Boolean);

    return {
        applicationId: application.id,
        seekerId: seeker.id,
        appliedAt: application.appliedAt,
        status: application.status || 'pending',
        requirementsMatch: application.requirementsMatch ?? application.matchScore ?? null,
        coverLetter: application.coverLetter || '',
        resumeUrl: findResume(application, seeker.id, resumes),
        profile: {
            fullName: profile.fullName || seeker.email,
            email: seeker.email,
            jobTitle: profile.jobTitle || '',
            location: profile.location || '',
            phone: profile.phone || '',
            website: profile.website || '',
            about: profile.about || '',
            languages: profile.languages || '',
            avatarSrc: profile.avatarSrc || '',
            skills,
            work: Array.isArray(seeker.work) ? seeker.work : [],
            education: Array.isArray(seeker.edu) ? seeker.edu : []
        }
    };
}

function publicJob(job) {
    return {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        employmentType: job.employmentType || job.jobType || ''
    };
}

function listApplicantsForJob(jobId, employerId, database = defaultDatabase) {
    const job = requireOwnedJob(jobId, employerId, database);
    const applications = database.readCollection('applications');
    const users = database.readCollection('users');
    const resumes = database.readCollection('resumes');

    const applicants = applications
        .filter(application => sameId(application.jobId, jobId))
        .map(application => applicantRecord(application, users, resumes))
        .filter(Boolean);

    return { job: publicJob(job), applicants };
}

function getApplicantForJob(jobId, applicationId, employerId, database = defaultDatabase) {
    const result = listApplicantsForJob(jobId, employerId, database);
    const applicant = result.applicants.find(record => sameId(record.applicationId, applicationId));

    if (!applicant) {
        throw new ApplicantServiceError('Applicant not found for this job opening.', 404);
    }

    return { job: result.job, applicant };
}

module.exports = {
    ApplicantServiceError,
    getApplicantForJob,
    listApplicantsForJob
};
