const googleSheets = require('../services/googleSheets');
const openai = require('../services/openai');
const OpenAIService = require('../services/openai').OpenAIService;
const History = require('../models/History');
const User = require('../models/User');
const sequelize = require('../config/sequelize');

// Constants
const RETRY_DELAY_MS = 10000; // Giảm xuống 10s
const MAX_RETRIES = 3; // Giảm số lần retry
const BATCH_SIZE = 20; // Tăng batch size
const BATCH_DELAY = 500; // Giảm delay giữa các batch
const OPENAI_RATE_LIMIT = 20; // Số request/phút cho OpenAI
const GOOGLE_RATE_LIMIT = 60; // Số request/phút cho Google Sheets

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

/**
 * Hàm translateData thực hiện việc dịch dữ liệu từ một ngôn ngữ sang ngôn ngữ khác.
 * 
 * @param {Array} data - Dữ liệu cần dịch, có thể là một mảng các mảng (tương ứng với các hàng và cột).
 * @param {string} targetLang - Ngôn ngữ đích mà dữ liệu sẽ được dịch sang.
 * @param {string} domain - Miền ngữ nghĩa cho việc dịch (nếu có).
 * @param {Object} translationService - Dịch vụ dịch thuật được sử dụng để thực hiện việc dịch.
 * @param {Object} req - Đối tượng yêu cầu từ Express, chứa thông tin về yêu cầu HTTP.
 * 
 * @returns {Array} - Mảng dữ liệu đã được dịch.
 */
async function translateData(data, targetLang, domain, translationService, req) {
    const total = data.length; // Tổng số ô cần dịch
    let completed = 0; // Số ô đã dịch
    const translatedData = []; // Mảng chứa dữ liệu đã dịch
    const customPrompt = req.body.customPrompt || ''; // Lấy prompt tùy chỉnh từ yêu cầu

    // Nếu chỉ có 1 ô
    if (data.length === 1 && data[0].length === 1) {
        const cell = data[0][0]; // Lấy ô duy nhất
        updateProgress(req, 50, 'Đang dịch...'); // Cập nhật tiến độ
        const translated = cell?.toString().trim()
            ? await translationService.translate(cell.toString().trim(), targetLang, domain, customPrompt) // Dịch ô
            : '';
        updateProgress(req, 100, 'Hoàn thành!'); // Cập nhật tiến độ hoàn thành
        return [[translated]]; // Trả về mảng chứa ô đã dịch
    }

    // Xử lý theo batch
    const batchSize = Math.min(20, Math.ceil(total / 10)); // Kích thước batch tối đa là 20 hoặc 1/10 tổng số ô

    for (let i = 0; i < data.length; i += batchSize) {
        const rowBatch = data.slice(i, i + batchSize); // Lấy batch hàng
        updateProgress(req, (i / total) * 100,
            `Đang xử lý batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)}...`
        ); // Cập nhật tiến độ cho batch

        // Dịch batch
        const batchResults = await Promise.all(
            rowBatch.map(async (row) => {
                const translatedRow = await Promise.all(
                    row.map(cell =>
                        cell?.toString().trim()
                            ? translationService.translate(cell.toString().trim(), targetLang, domain, customPrompt) // Dịch từng ô trong hàng
                            : ''
                    )
                );

                completed++; // Tăng số ô đã dịch
                const percent = (completed / total) * 100; // Tính phần trăm đã dịch
                updateProgress(req, percent,
                    `Đã dịch ${completed}/${total} dòng (${Math.round(percent)}%)`
                ); // Cập nhật tiến độ
                return translatedRow; // Trả về hàng đã dịch
            })
        );

        translatedData.push(...batchResults); // Thêm kết quả vào mảng dữ liệu đã dịch

        if (i + batchSize < data.length) {
            const delayMs = Math.min(1000, batchSize * 50); // Tính thời gian delay
            await delay(delayMs); // Delay giữa các batch
        }
    }

    return translatedData; // Trả về dữ liệu đã dịch
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
    const details = {
      inputTokens: pricing.details.inputTokens,
      outputTokens: pricing.details.outputTokens,
      inputCost: `$${pricing.inputCost.toFixed(4)}`,
      outputCost: `$${pricing.outputCost.toFixed(4)}`,
      inputRate: pricing.details.inputRate,
      outputRate: pricing.details.outputRate,
    };

    return {
        totalCells,
        totalChars,
        model: pricing.model,
        estimatedCost: `$${pricing.totalCost.toFixed(4)}`,
        details: details
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
        if (!req.session?.user) {
            res.status(401).json({});
        }

        const user = await User.findOne({ where: { id: req.session.user.id } });
        if (!user) {    
            return res.status(404).json({
                success: false,
                error: "Tài khoản đã bị xóa",
            });
        }

        if (user.balance <= 0.0001) {
            return res.status(403).json({
                success: false,
                error: "Số dư không đủ,hãy liên hệ admin để tiếp tục sử dụng",
            });
        }
        
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

            // Save history
            const history = {
                ...stats.details,
                ...req.body,
                userId: req.session.user.id,
                totalCells: stats.totalCells,
                totalChars: stats.totalChars,
                inputCost: stats.details.inputCost.slice(1),
                outputCost: stats.details.outputCost.slice(1),
                estimatedCost: stats.estimatedCost.slice(1),
            };

            user.balance = user.balance >= parseFloat(stats.estimatedCost.slice(1)) ? user.balance - parseFloat(stats.estimatedCost.slice(1)) : 0;
            
            await sequelize.transaction(async (t) => {
                await user.save({ transaction: t });
                await History.create(history, { transaction: t });
            });
              

            res.json({
                success: true,
                message: 'Dịch thành công!',
                stats
            });

        } catch (error) {
            console.error('Translation error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new TranslateController();