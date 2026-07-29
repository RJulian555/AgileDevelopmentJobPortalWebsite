(function initialiseJobDate(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.JobDate = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createJobDate() {
    const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

    function formatRelativeDate(dateOnly, referenceDate = new Date(), locale = 'en-MY') {
        const posted = parseLocalDateOnly(dateOnly);
        if (!posted) return 'on an unknown date';

        const today = new Date(referenceDate);
        const postedDay = Date.UTC(posted.getFullYear(), posted.getMonth(), posted.getDate());
        const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const differenceInDays = Math.round((todayDay - postedDay) / DAY_IN_MILLISECONDS);

        if (differenceInDays === 0) return 'today';
        if (differenceInDays === 1) return 'yesterday';
        if (differenceInDays > 1 && differenceInDays < 7) {
            return `${differenceInDays} days ago`;
        }
        if (differenceInDays >= 7 && differenceInDays < 30) {
            const weeks = Math.floor(differenceInDays / 7);
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        }

        return posted.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    function parseLocalDateOnly(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!match) return null;

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(year, month - 1, day);

        if (date.getFullYear() !== year
            || date.getMonth() !== month - 1
            || date.getDate() !== day) {
            return null;
        }

        return date;
    }

    return { formatRelativeDate, parseLocalDateOnly };
}));
