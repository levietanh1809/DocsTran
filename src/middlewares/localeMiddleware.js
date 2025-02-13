function localeMiddleware(req, res, next) {
    // Kiểm tra query parameter lang
    const lang = req.query.lang;
    if (lang && ['en', 'vi'].includes(lang)) {
        // Lưu locale vào cookie
        res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 năm
        req.setLocale(lang);
    }

    // Thêm các biến cần thiết vào res.locals
    res.locals = {
        ...res.locals,
        currentLocale: req.getLocale(),
        currentPath: req.path,
        fullUrl: req.originalUrl
    };

    next();
}

module.exports = localeMiddleware; 