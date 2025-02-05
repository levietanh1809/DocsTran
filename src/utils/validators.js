function isValidGoogleDocsUrl(url) {
    const googleDocsRegex = /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+/;
    return googleDocsRegex.test(url);
}

function isValidGoogleSheetUrl(url) {
    return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(url);
}

function isValidGoogleSheetId(id) {
    // Google Sheet ID thường là một chuỗi 44 ký tự
    return /^[a-zA-Z0-9-_]{10,}$/.test(id);
}

function extractSheetId(url) {
    const match = url.match(/\/d\/(.*?)(\/|$)/);
    return match ? match[1] : null;
}

module.exports = {
    isValidGoogleDocsUrl,
    isValidGoogleSheetUrl,
    isValidGoogleSheetId,
    extractSheetId
}; 