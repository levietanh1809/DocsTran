const googleSheets = require('../services/googleSheets');
const openai = require('../services/openai');

// Constants
const RETRY_DELAY_MS = 20000; // 20s cho rate limit retry
const MAX_RETRIES = 5;
const BATCH_SIZE = 10;
const BATCH_DELAY = 1000;
const OPENAI_RATE_LIMIT = 20;    // Số request/phút cho OpenAI
const GOOGLE_RATE_LIMIT = 60;    // Số request/phút cho Google Sheets

// Helper functions
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function updateProgress(percent, detail) {
    if (global.progressClient) {
        try {
            global.progressClient.write(`data: ${JSON.stringify({
                percent: Math.min(100, Math.max(0, Math.round(percent))),
                detail: detail || `Đã dịch ${Math.min(100, Math.max(0, Math.round(percent)))}%`
            })}\n\n`);
        } catch (error) {
            console.error('Error sending progress:', error);
        }
    }
}

// Tách hàm translateData ra khỏi class để tránh vấn đề về context
async function translateData(data, targetLang, domain) {
    const total = data.length;
    let completed = 0;

    // Xử lý theo batch để tránh quá tải
    const CONCURRENT_BATCH = 5; // Số lượng cell xử lý đồng thời
    const translatedData = [];

    // Xử lý từng row
    for (const row of data) {
        // Tạo mảng promises cho các cell trong row
        const cellPromises = row.map(async (cell) => {
            if (!cell || cell.toString().trim() === '') {
                return '';
            }
            return await openai.translate(cell.toString().trim(), targetLang, domain);
        });

        // Xử lý song song theo batch
        const translatedRow = [];
        for (let i = 0; i < cellPromises.length; i += CONCURRENT_BATCH) {
            const batch = cellPromises.slice(i, i + CONCURRENT_BATCH);
            const results = await Promise.all(batch);
            translatedRow.push(...results);
        }

        translatedData.push(translatedRow);
        
        completed++;
        updateProgress((completed / total) * 100);
        
        // Giảm delay giữa các batch
        if (completed % BATCH_SIZE === 0) {
            await delay(500); // Giảm delay xuống 500ms
        }
    }

    return translatedData;
}

class TranslateController {
    // GET /
    showTranslatePage(req, res) {
        res.render('translate', {
            title: 'Dịch thuật tài liệu',
            error: null,
            success: null
        });
    }

    // POST /api/translate-sheet
    async handleSheetTranslation(req, res) {
        try {
            const { sheetUrl, sheetName, sheetRange, targetLang, domain } = req.body;
            
            // Validate input
            if (!sheetUrl || !sheetName || !targetLang || !domain) {
                throw new Error('Thiếu thông tin cần thiết');
            }

            // Extract sheet ID
            const sheetId = sheetUrl.match(/\/d\/(.*?)(\/|$)/)?.[1];
            if (!sheetId) {
                throw new Error('URL Google Sheet không hợp lệ');
            }

            // Tạo range với tên sheet
            const fullRange = `${sheetName}!${sheetRange}`;

            // Get sheet data
            const data = await googleSheets.readSheet(sheetId, fullRange);
            
            // Start translation
            const translatedData = await translateData(data, targetLang, domain);
            
            // Update sheet với range đầy đủ
            await googleSheets.updateSheet(sheetId, fullRange, translatedData);

            res.json({
                success: true,
                message: 'Dịch thành công!'
            });

        } catch (error) {
            console.error('Translation error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new TranslateController(); 