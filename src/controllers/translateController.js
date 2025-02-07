const googleSheets = require('../services/googleSheets');
const openai = require('../services/openai');
const OpenAIService = require('../services/openai').OpenAIService;

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
async function translateData(data, targetLang, domain, translationService) {
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
            return await translationService.translate(cell.toString().trim(), targetLang, domain);
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

// Thêm hàm tính thống kê
function calculateStats(data, translatedData) {
    let totalChars = 0;
    let totalCells = 0;

    translatedData.forEach(row => {
        row.forEach(cell => {
            if (cell && cell.trim()) {
                totalCells++;
                totalChars += cell.length;
            }
        });
    });

    // Tính chi phí dựa trên OpenAI API
    const pricing = openai.calculatePrice(totalChars);

    return {
        totalCells,
        totalChars,
        model: pricing.model,
        estimatedCost: `$${pricing.totalCost.toFixed(4)}`,
        details: {
            inputTokens: pricing.details.inputTokens,
            outputTokens: pricing.details.outputTokens,
            inputCost: `$${pricing.inputCost.toFixed(4)}`,
            outputCost: `$${pricing.outputCost.toFixed(4)}`,
            inputRate: pricing.details.inputRate,
            outputRate: pricing.details.outputRate
        }
    };
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
            const { sheetUrl, sheetName, sheetRange, targetLang, domain, apiKey } = req.body;
            
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

            // Khởi tạo OpenAI service với custom API key nếu có
            let translationService;
            try {
                translationService = apiKey ? new OpenAIService(apiKey) : openai;
            } catch (error) {
                throw new Error(`Lỗi API key: ${error.message}`);
            }

            // Get sheet data
            const data = await googleSheets.readSheet(sheetId, fullRange);
            
            // Start translation với service tương ứng
            const translatedData = await translateData(data, targetLang, domain, translationService);
            
            // Update sheet với range đầy đủ
            await googleSheets.updateSheet(sheetId, fullRange, translatedData);

            // Tính toán thống kê
            const stats = calculateStats(data, translatedData);

            res.json({
                success: true,
                message: 'Dịch thành công!',
                stats
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