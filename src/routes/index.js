const express = require('express');
const router = express.Router();
const translateController = require('../controllers/translateController');
const validateGoogleSheet = require('../middlewares/validateGoogleSheet');
const googleSheets = require('../services/googleSheets');
const { OpenAIService } = require('../services/openai');

// Trang chủ
router.get('/', (req, res) => {
    res.render('home', {
        title: 'Trang chủ'
    });
});

// Trang dịch
router.get('/translate', (req, res) => {
    res.render('translate', {
        title: 'Dịch thuật tài liệu',
        error: null,
        success: null,
        googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL
    });
});

// Các trang tĩnh
router.get('/about', (req, res) => {
    res.render('about', {
        title: req.__('pages.about.title')
    });
});

router.get('/terms', (req, res) => {
    res.render('terms', {
        title: req.__('pages.terms.title')
    });
});

router.get('/privacy', (req, res) => {
    res.render('privacy', {
        title: req.__('pages.privacy.title')
    });
});

router.get('/support', (req, res) => {
    res.render('support', {
        title: req.__('pages.support.title')
    });
});

// API endpoints
router.post('/api/translate-sheet', validateGoogleSheet, translateController.handleSheetTranslation);

router.post('/api/sheets/list', async (req, res) => {
    try {
        const { sheetUrl } = req.body;
        const sheetId = sheetUrl.match(/\/d\/(.*?)(\/|$)/)?.[1];
        
        if (!sheetId) {
            throw new Error('URL Google Sheet không hợp lệ');
        }

        const sheets = await googleSheets.getSheetsList(sheetId);
        res.json({ success: true, sheets });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/api/translation-progress', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Gửi event đầu tiên để kiểm tra kết nối
    res.write(`data: ${JSON.stringify({
        percent: 0,
        detail: 'Đang kết nối...'
    })}\n\n`);

    // Lưu client connection vào app.locals
    req.app.locals.progressClient = res;

    // Cleanup khi client disconnect
    req.on('close', () => {
        req.app.locals.progressClient = null;
    });
});

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// API validate OpenAI key
router.post('/api/validate-key', async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        // Thử khởi tạo service với API key mới
        try {
            const service = new OpenAIService(apiKey);
            // Thử gọi một request đơn giản để kiểm tra key
            await service.translate('test', 'en', 'general');
            res.json({ success: true });
        } catch (error) {
            res.json({ 
                success: false, 
                error: 'API key không hợp lệ hoặc đã hết hạn'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 