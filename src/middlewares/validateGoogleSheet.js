const { isValidGoogleSheetId, isValidGoogleSheetUrl } = require('../utils/validators');

function validateRange(range) {
    if (!range || range.trim() === '') return true; // Range là optional

    // Chuẩn hóa input
    range = range.trim().toUpperCase();

    // Kiểm tra có dấu :
    if (!range.includes(':')) {
        throw new Error('Định dạng vùng dữ liệu không hợp lệ (VD: A2:A10, D:D, 44:46)');
    }

    const [start, end] = range.split(':');

    // Kiểm tra format cột (D:D)
    const columnFormat = /^[A-Z]$/;
    if (columnFormat.test(start) && columnFormat.test(end)) {
        // Kiểm tra thứ tự cột
        if (start.charCodeAt(0) > end.charCodeAt(0)) {
            throw new Error('Cột bắt đầu phải nhỏ hơn hoặc bằng cột kết thúc');
        }
        return true;
    }

    // Kiểm tra format dòng (1:10)
    const rowFormat = /^\d+$/;
    if (rowFormat.test(start) && rowFormat.test(end)) {
        // Kiểm tra thứ tự dòng
        if (parseInt(start) > parseInt(end)) {
            throw new Error('Dòng bắt đầu phải nhỏ hơn hoặc bằng dòng kết thúc');
        }
        return true;
    }

    // Kiểm tra format đầy đủ (A2:A10)
    const cellFormat = /^[A-Z]+\d+$/;
    if (cellFormat.test(start) && cellFormat.test(end)) {
        // Tách cột và dòng
        const startCol = start.match(/^[A-Z]+/)[0];
        const startRow = parseInt(start.match(/\d+$/)[0]);
        const endCol = end.match(/^[A-Z]+/)[0];
        const endRow = parseInt(end.match(/\d+$/)[0]);

        // Kiểm tra thứ tự
        if (startCol > endCol || startRow > endRow) {
            throw new Error('Vùng chọn không hợp lệ (cột/dòng bắt đầu phải nhỏ hơn hoặc bằng cột/dòng kết thúc)');
        }
        return true;
    }

    throw new Error('Định dạng vùng dữ liệu không hợp lệ (VD: A2:A10, D:D, 44:46)');
}

function validateGoogleSheet(req, res, next) {
    const { projectName, sheetUrl, sheetName, sheetRange, targetLang, domain } = req.body;
    
    if (!projectName?.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Tên dự án không được để trống'
        });
    }

    if (!isValidGoogleSheetUrl(sheetUrl)) {
        return res.status(400).json({
            success: false,
            error: 'URL Google Sheet không hợp lệ'
        });
    }

    if (!sheetName?.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Vui lòng chọn sheet cần dịch'
        });
    }

    // Chỉ validate sheet range nếu người dùng có nhập
    if (sheetRange?.trim()) {
        validateRange(sheetRange);
    }

    const validLangs = ['en', 'vi', 'ja', 'ko', 'zh'];
    if (!validLangs.includes(targetLang)) {
        return res.status(400).json({
            success: false,
            error: 'Ngôn ngữ đích không hợp lệ'
        });
    }

    const validDomains = ['general', 'technical', 'medical', 'legal', 'business'];
    if (!validDomains.includes(domain)) {
        return res.status(400).json({
            success: false,
            error: 'Lĩnh vực không hợp lệ'
        });
    }
    
    next();
}

module.exports = validateGoogleSheet; 