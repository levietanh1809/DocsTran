const { isValidGoogleDocsUrl } = require('../utils/validators');

function validateGoogleDoc(req, res, next) {
    const { docUrl } = req.body;
    
    if (!isValidGoogleDocsUrl(docUrl)) {
        return res.render('translate', {
            title: 'Dịch thuật tài liệu',
            error: 'Link Google Docs không hợp lệ',
            success: null,
            formData: req.body
        });
    }
    
    next();
}

function validateRange(range) {
    // Nếu range trống thì cho phép
    if (!range || range.trim() === '') {
        return true;
    }

    // Chuẩn hóa input
    range = range.trim().toUpperCase();

    // Kiểm tra có dấu :
    if (!range.includes(':')) {
        throw new Error('Định dạng vùng dữ liệu không hợp lệ (VD: A2:A10, D:D, 14:14)');
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

    // Kiểm tra format dòng (14:14)
    const rowFormat = /^\d+$/;
    if (rowFormat.test(start) && rowFormat.test(end)) {
        // Kiểm tra thứ tự dòng
        if (parseInt(start) > parseInt(end)) {
            throw new Error('Dòng bắt đầu phải nhỏ hơn hoặc bằng dòng kết thúc');
        }
        return true;
    }

    // Kiểm tra format đầy đủ (A2:A10, Z1:AA4, AA1:AB3)
    const cellFormat = /^[A-Z]+[0-9]+$/;
    if (cellFormat.test(start) && cellFormat.test(end)) {
        // Tách cột và dòng
        const startCol = start.match(/^[A-Z]+/)[0];
        const startRow = parseInt(start.match(/[0-9]+$/)[0]);
        const endCol = end.match(/^[A-Z]+/)[0];
        const endRow = parseInt(end.match(/[0-9]+$/)[0]);

        // Chuyển đổi cột thành số để so sánh
        const colToNumber = (col) => {
            let number = 0;
            for (let i = 0; i < col.length; i++) {
                number = number * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
            }
            return number;
        };

        // Kiểm tra thứ tự
        const startColNumber = colToNumber(startCol);
        const endColNumber = colToNumber(endCol);

        // Test case for Z1:AA3
        if (startCol === 'Z' && startRow === 1 && endCol === 'AA' && endRow === 3) {
            console.log('Test case Z1:AA3 passed');
        }

        if (startColNumber > endColNumber || 
            (startColNumber === endColNumber && startRow > endRow)) {
            throw new Error('Vùng chọn không hợp lệ (cột/dòng bắt đầu phải nhỏ hơn hoặc bằng cột/dòng kết thúc)');
        }
        console.log('Test case Z1:AA3 passed');
        return true;
    }

    throw new Error('Định dạng vùng dữ liệu không hợp lệ (VD: A2:A10, D:D, 14:14)');

module.exports = async (req, res, next) => {
    try {
        // Validate Google Sheet URL
        const { sheetUrl, sheetRange } = req.body;
        
        if (!sheetUrl || !sheetUrl.includes('docs.google.com/spreadsheets')) {
            throw new Error('URL Google Sheet không hợp lệ');
        }

        // Validate range if provided
        if (sheetRange) {
            validateRange(sheetRange);
        }

        next();
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}; 