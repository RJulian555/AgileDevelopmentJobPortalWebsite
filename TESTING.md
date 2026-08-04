## testing the user story US-15 (As a job seeker, I want to apply for a job posting so that my profile and uploaded resume can be automatically submitted.)

### happy path: has profile + resume
localStorage.setItem('currentSeeker', '1785053640961'); 
location.reload();

### no resume
remove the current seeker entry from `resumes.json`
OR
change **resumeUrl** to ""

### no profile
localStorage.setItem('currentSeeker', '999999999999'); 
location.reload();

### no duplicate application
restore current seeker

localStorage.setItem('currentSeeker', '1785053640961'); 
location.reload();

then you should see the applied job posting has the apply button disabled