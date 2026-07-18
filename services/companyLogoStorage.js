const fs = require('fs');
const path = require('path');

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_DIRECTORY = path.join(__dirname, '..', 'public', 'uploads', 'company-logos');
const SUPPORTED_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
};

function storeCompanyLogo(companyId, logoData, directory = LOGO_DIRECTORY) {
    if (!logoData) return '';

    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(logoData);
    if (!match) throw new Error('Company logo must be a PNG, JPEG, or WebP image.');

    const [, mimeType, encodedImage] = match;
    const image = Buffer.from(encodedImage, 'base64');
    if (!image.length || image.length > MAX_LOGO_BYTES) {
        throw new Error('Company logo must be no larger than 2 MB.');
    }

    if (!hasValidSignature(image, mimeType)) {
        throw new Error('Company logo content does not match its image type.');
    }

    const extension = SUPPORTED_TYPES[mimeType];
    const safeCompanyId = String(companyId).replace(/[^a-zA-Z0-9-]/g, '');
    const fileName = `${safeCompanyId}.${extension}`;

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, fileName), image);

    return `/uploads/company-logos/${fileName}`;
}

function hasValidSignature(image, mimeType) {
    if (mimeType === 'image/png') {
        return image.length >= 8 && image.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    }

    if (mimeType === 'image/jpeg') {
        return image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    }

    return image.length >= 12
        && image.subarray(0, 4).toString('ascii') === 'RIFF'
        && image.subarray(8, 12).toString('ascii') === 'WEBP';
}

module.exports = { MAX_LOGO_BYTES, storeCompanyLogo };
