const Translation = require('../models/Translation');
const googleSheets = require('../services/googleSheets');
const openai = require('../services/openai');
const { query } = require('../services/sql');

// Constants
const RETRY_DELAY_MS = 20000; // 20s cho rate limit retry
const MAX_RETRIES = 5;
const BATCH_SIZE = 10;
const BATCH_DELAY = 1000;
const OPENAI_RATE_LIMIT = 20;    // Số request/phút cho OpenAI
const GOOGLE_RATE_LIMIT = 60;    // Số request/phút cho Google Sheets

// Helper functions
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Thêm hàm updateProgress
function updateProgress(percent, detail) {
    if (global.progressClient) {
        global.progressClient.write(`data: ${JSON.stringify({
            percent,
            detail: detail || `Đã dịch ${percent}%`
        })}\n\n`);
    }
}

async function translateDataPerCell(rows, targetLang, domain) {
    const translatedRows = [];
    for (let row of rows) {
        const translatedRow = [];
        for (let cell of row) {
            // Bỏ delay giữa các lần dịch
            const translatedCell = await translateCell(cell, targetLang, domain);
            translatedRow.push(translatedCell);
        }
        translatedRows.push(translatedRow);
    }
    return translatedRows;
}

async function translateCell(text, targetLang, domain, retries = 3) {
    if (!text || text.toString().trim() === '') {
        return '';
    }

    try {
        const translatedText = await openai.translate(text.toString().trim(), targetLang, domain);
        return translatedText;
    } catch (error) {
        if (retries > 0 && error.message.includes('Rate limit')) {
            console.log(`Rate limit hit, retrying in 1s... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return translateCell(text, targetLang, domain, retries - 1);
        }
        throw error;
    }
}

class TranslateController {
    // GET /
    showTranslatePage(req, res) {
        res.render('translate', {
            title: 'Dịch thuật tài liệu',
            error: null,
            success: null,
            script: '<script src="/js/translate.js"></script>'
        });
    }

    // POST /translate
    async handleTranslate(req, res) {
        const { docUrl, targetLang, domain } = req.body;

        try {
            await Translation.create({
                docUrl,
                sourceLang: 'vi',
                targetLang,
                domain
            });
            
            res.render('translate', {
                title: 'Dịch thuật tài liệu',
                error: null,
                success: 'Tài liệu đã được gửi để dịch thuật',
                formData: req.body,
                script: '<script src="/js/form-validation.js"></script>'
            });
        } catch (error) {
            res.render('translate', {
                title: 'Dịch thuật tài liệu',
                error: error.message,
                success: null,
                formData: req.body,
                script: '<script src="/js/form-validation.js"></script>'
            });
        }
    }

    // GET /translations
    async getTranslations(req, res) {
        try {
            const translations = await Translation.findAll();
            res.render('translations', {
                title: 'Lịch sử dịch thuật',
                translations,
                error: null,
                script: ''
            });
        } catch (error) {
            res.render('translations', {
                title: 'Lịch sử dịch thuật',
                translations: [],
                error: 'Không thể tải lịch sử dịch thuật',
                script: ''
            });
        }
    }

    async handleSheetTranslation(req, res) {
        try {
            console.log('1. Request body:', req.body);
            const { projectName, sheetUrl, sheetName, sheetRange, targetLang, domain, model } = req.body;

            // Trích xuất Sheet ID từ URL
            const sheetId = sheetUrl.match(/\/d\/(.*?)(\/|$)/)?.[1];
            if (!sheetId) {
                throw new Error('URL Google Sheet không hợp lệ');
            }

            // Parse range với validation
            const rangeDetails = parseRange(sheetRange);
            console.log('Range details:', {
                type: rangeDetails.type,
                startCol: rangeDetails.startCol,
                endCol: rangeDetails.endCol,
                startRow: rangeDetails.startRow,
                endRow: rangeDetails.endRow
            });

            // Tạo full range để đọc dữ liệu
            const fullRange = `${sheetName}!${rangeDetails.startCol}${rangeDetails.startRow}:${rangeDetails.endCol}${rangeDetails.endRow}`;
            console.log('Reading range:', fullRange);

            // Đọc dữ liệu từ Google Sheet
            const response = await googleSheets.readSheet(sheetId, fullRange);
            let rawData = Array.isArray(response) ? response : (response.values || []);

            // Validate dữ liệu trả về
            if (!rawData || rawData.length === 0) {
                throw new Error('Không tìm thấy dữ liệu trong vùng đã chọn');
            }

            console.log('Raw data received:', {
                rows: rawData.length,
                columns: rawData[0]?.length || 0,
                sample: rawData.slice(0, 2)
            });

            // Tạo object chứa dữ liệu
            const sheetData = {
                original: {},
                translated: {}
            };

            // Xử lý dữ liệu theo từng trường hợp
            const startColIndex = columnToIndex(rangeDetails.startCol);
            const endColIndex = columnToIndex(rangeDetails.endCol);

            rawData.forEach((row, rowIndex) => {
                const currentRow = rangeDetails.startRow + rowIndex;
                
                // Chỉ xử lý trong range được chọn
                if (currentRow >= rangeDetails.startRow && currentRow <= rangeDetails.endRow) {
                    // Với mỗi cột trong range
                    for (let colIndex = 0; colIndex <= endColIndex - startColIndex; colIndex++) {
                        const cell = row[colIndex];
                        if (cell && cell.toString().trim()) {
                            const currentColumn = getColumnLetter(startColIndex + colIndex);
                            const cellKey = `${currentColumn}${currentRow}`;
                            
                            console.log('Processing cell:', {
                                row: currentRow,
                                column: currentColumn,
                                value: cell
                            });

                            sheetData.original[cellKey] = cell.toString().trim();
                        }
                    }
                }
            });

            // Validate kết quả
            const totalCells = Object.keys(sheetData.original).length;
            if (totalCells === 0) {
                throw new Error('Không tìm thấy dữ liệu cần dịch trong vùng đã chọn');
            }

            console.log('Processed data:', {
                totalCells,
                sampleCells: Object.entries(sheetData.original).slice(0, 3)
            });

            // Tạo project và source
            const projectResult = await query`
                INSERT INTO Projects (Name) 
                VALUES (${projectName});
                SELECT SCOPE_IDENTITY() AS id;
            `;
            const projectId = projectResult.recordset[0].id;

            const sourceResult = await query`
                INSERT INTO TranslationSources (ProjectId, Type, SourceUrl, SheetRange)
                VALUES (
                    ${projectId}, 
                    'google_sheet', 
                    ${`https://docs.google.com/spreadsheets/d/${sheetId}`}, 
                    ${fullRange}
                );
                SELECT SCOPE_IDENTITY() AS id;
            `;
            const sourceId = sourceResult.recordset[0].id;

            // Tính tổng ký tự để ước tính chi phí
            let totalChars = 0;
            Object.values(sheetData.original).forEach(text => {
                totalChars += text.length;
            });

            // Tính giá dựa trên model mặc định và số ký tự
            const pricing = openai.calculatePrice(totalChars);
            const stats = {
                totalCells: Object.keys(sheetData.original).length,
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

            console.log('Translation stats:', {
                totalCells: Object.keys(sheetData.original).length,
                totalChars,
                estimatedTokens: pricing.details.inputTokens,
                estimatedCost: `$${pricing.totalCost.toFixed(4)}`
            });

            // Khởi tạo mảng errors
            const errors = [];

            // Xử lý dữ liệu theo batch lớn hơn
            const batches = chunkArray(Object.entries(sheetData.original), BATCH_SIZE);
            
            // Tính toán tổng progress (80% cho dịch, 20% cho update)
            const translationWeight = 80;
            const updateWeight = 20;
            
            // Dịch từng batch
            const totalTranslationBatches = batches.length;
            for (let [batchIndex, batch] of batches.entries()) {
                // Xử lý song song các cell trong batch
                const batchPromises = batch.map(([key, text]) => 
                    translateCell(text, targetLang, domain)
                        .then(translatedText => {
                            sheetData.translated[key] = translatedText;
                            return { key, translatedText };
                        })
                );

                // Đợi tất cả các promises trong batch hoàn thành
                await Promise.all(batchPromises);

                // Cập nhật progress cho phần dịch (0-80%)
                const translationProgress = Math.round((batchIndex + 1) * translationWeight / totalTranslationBatches);
                updateProgress(translationProgress, `Đang dịch: ${translationProgress}%`);

                // Giảm delay giữa các batch
                if (batchIndex < batches.length - 1) {
                    await delay(BATCH_DELAY);
                }
            }

            // Cập nhật Google Sheet theo batch
            console.log('Updating sheet with translated data...');
            const updateBatches = chunkArray(Object.entries(sheetData.translated), BATCH_SIZE);
            const totalUpdateBatches = updateBatches.length;

            for (let [batchIndex, batch] of updateBatches.entries()) {
                try {
                    const updates = batch.map(([cellKey, translatedText]) => ({
                        range: `${sheetName}!${cellKey}`,
                        values: [translatedText]
                    }));

                    await googleSheets.batchUpdate(sheetId, updates);

                    // Cập nhật progress cho phần update (80-100%)
                    const currentProgress = translationWeight + 
                        Math.round((batchIndex + 1) * updateWeight / totalUpdateBatches);
                    updateProgress(currentProgress, `Đang cập nhật tài liệu: ${currentProgress}%`);

                    await delay(BATCH_DELAY);
                } catch (updateError) {
                    console.error('Batch update error:', updateError);
                    errors.push(`Lỗi cập nhật batch: ${updateError.message}`);
                }
            }

            // Hoàn thành 100%
            updateProgress(100, 'Hoàn thành dịch và cập nhật tài liệu!');

            res.json({
                success: true,
                message: errors.length > 0 
                    ? `Dự án đã hoàn thành với ${errors.length} lỗi` 
                    : 'Dự án dịch thuật đã hoàn thành',
                stats,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error('Translation error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Thêm method mới
    async getModels(req, res) {
        try {
            const models = await openai.getModelsWithPricing();
            res.json({
                success: true,
                models
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

// Helper function để chuyển cột từ chữ sang số (A=0, B=1, etc)
function columnToIndex(column) {
    let value = 0;
    for (let i = 0; i < column.length; i++) {
        value = value * 26 + column.charCodeAt(i) - 64;
    }
    return value - 1;
}

// Helper function để parse range linh hoạt
function parseRange(range) {
    // Nếu không có range, lấy toàn bộ sheet
    if (!range || range.trim() === '') {
        return {
            type: 'full',
            startCol: 'A',
            endCol: 'Z',
            startRow: 1,
            endRow: 1000
        };
    }

    // Chuẩn hóa range input
    range = range.trim().toUpperCase();

    // Case 1: Full range (e.g., "C23:D34")
    const fullRangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (fullRangeMatch) {
        const [, startCol, startRow, endCol, endRow] = fullRangeMatch;
        // Validate column order
        if (columnToIndex(startCol) > columnToIndex(endCol)) {
            throw new Error('Cột bắt đầu phải nhỏ hơn hoặc bằng cột kết thúc');
        }
        return {
            type: 'full',
            startCol,
            startRow: parseInt(startRow),
            endCol,
            endRow: parseInt(endRow)
        };
    }

    // Case 2: Column range (e.g., "C:D" or "D:D")
    const columnRangeMatch = range.match(/^([A-Z]):([A-Z])$/);
    if (columnRangeMatch) {
        const [, startCol, endCol] = columnRangeMatch;
        // Validate column order
        if (columnToIndex(startCol) > columnToIndex(endCol)) {
            throw new Error('Cột bắt đầu phải nhỏ hơn hoặc bằng cột kết thúc');
        }
        return {
            type: 'column',
            startCol,
            endCol,
            startRow: 1,
            endRow: 1000
        };
    }

    // Case 3: Row range (e.g., "44:46")
    const rowRangeMatch = range.match(/^(\d+):(\d+)$/);
    if (rowRangeMatch) {
        const [, startRow, endRow] = rowRangeMatch;
        const startRowNum = parseInt(startRow);
        const endRowNum = parseInt(endRow);
        
        // Validate row order
        if (startRowNum > endRowNum) {
            throw new Error('Dòng bắt đầu phải nhỏ hơn hoặc bằng dòng kết thúc');
        }
        
        return {
            type: 'row',
            startCol: 'A',
            endCol: 'Z',
            startRow: startRowNum,
            endRow: endRowNum
        };
    }

    // Log để debug
    console.log('Invalid range:', {
        input: range,
        fullRangeMatch: range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/),
        columnRangeMatch: range.match(/^([A-Z]):([A-Z])$/),
        rowRangeMatch: range.match(/^(\d+):(\d+)$/)
    });

    throw new Error('Range không đúng định dạng. Ví dụ hợp lệ: C23:D34, C:D, 44:46');
}

// Helper function để tính toán tên cột chính xác
function getColumnLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode(65 + (index % 26)) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

// Helper function để chia nhỏ array thành các batch
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

module.exports = new TranslateController(); 