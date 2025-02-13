const googleSheets = require('../services/googleSheets');
const openai = require('../services/openai');
const OpenAIService = require('../services/openai').OpenAIService;

// Constants
const RETRY_DELAY_MS = 10000; // Giảm xuống 10s
const MAX_RETRIES = 3;  // Giảm số lần retry
const BATCH_SIZE = 20;  // Tăng batch size
const BATCH_DELAY = 500; // Giảm delay giữa các batch
const OPENAI_RATE_LIMIT = 20;    // Số request/phút cho OpenAI
const GOOGLE_RATE_LIMIT = 60;    // Số request/phút cho Google Sheets

// Helper functions
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function updateProgress(req, percent, detail) {
    if (req.app.locals.progressClient) {
        try {
            const progress = {
                percent: Math.min(100, Math.max(0, Math.round(percent))),
                detail: detail || 'Đang xử lý...',
                status: percent >= 100 ? 'completed' : 'processing'
            };

            req.app.locals.progressClient.write(`data: ${JSON.stringify(progress)}\n\n`);
        } catch (error) {
            console.error('Error sending progress:', error);
        }
    }
}

// Thêm tham số req vào hàm translateData
async function translateData(data, targetLang, domain, translationService, req) {
    const total = data.length;
    let completed = 0;
    const translatedData = [];

    // Nếu chỉ có 1 cell
    if (data.length === 1 && data[0].length === 1) {
        const cell = data[0][0];
        updateProgress(req, 50, 'Đang dịch...');
        const translated = cell?.toString().trim() 
            ? await translationService.translate(cell.toString().trim(), targetLang, domain)
            : '';
        updateProgress(req, 100, 'Hoàn thành!');
        return [[translated]];
    }

    // Xử lý theo batch
    const batchSize = Math.min(20, Math.ceil(total / 10));
    
    for (let i = 0; i < data.length; i += batchSize) {
        const rowBatch = data.slice(i, i + batchSize);
        updateProgress(req, (i / total) * 100, 
            `Đang xử lý batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(total/batchSize)}...`
        );

        // Translate batch
        const batchResults = await Promise.all(
            rowBatch.map(async (row) => {
                const translatedRow = await Promise.all(
                    row.map(cell => 
                        cell?.toString().trim() 
                            ? translationService.translate(cell.toString().trim(), targetLang, domain)
                            : ''
                    )
                );
                
                completed++;
                const percent = (completed / total) * 100;
                updateProgress(req, percent, 
                    `Đã dịch ${completed}/${total} dòng (${Math.round(percent)}%)`
                );
                return translatedRow;
            })
        );

        translatedData.push(...batchResults);

        if (i + batchSize < data.length) {
            const delayMs = Math.min(1000, batchSize * 50);
            await delay(delayMs);
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

/**
 * Smarttrans Translation Controller
 */
class TranslateController {
    // GET /translate
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
            const fullRange = sheetRange ? `${sheetName}!${sheetRange}` : sheetName;

            // Khởi tạo OpenAI service với custom API key nếu có
            let translationService;
            try {
                translationService = apiKey ? new OpenAIService(apiKey) : openai;
            } catch (error) {
                throw new Error(`Lỗi API key: ${error.message}`);
            }

            updateProgress(req, 20, 'Đang đọc dữ liệu...');
            
            const data = await googleSheets.readSheet(sheetId, fullRange);
            
            if (data.length * data[0].length > 1000) {
                updateProgress(req, 0, 'Đang xử lý dữ liệu lớn, có thể mất nhiều thời gian...');
            }
            
            // Truyền thêm req vào hàm translateData
            const translatedData = await translateData(
                data, 
                targetLang, 
                domain, 
                translationService,
                req
            );
            
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