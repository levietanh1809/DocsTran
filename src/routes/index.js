const express = require('express');
const router = express.Router();
const translateController = require('../controllers/translateController');
const validateGoogleDoc = require('../middlewares/validateGoogleDoc');
const validateGoogleSheet = require('../middlewares/validateGoogleSheet');
const googleSheets = require('../services/googleSheets');

router.get('/', translateController.showTranslatePage);
router.post('/translate', validateGoogleDoc, translateController.handleTranslate);
router.get('/translations', translateController.getTranslations);
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

    // Lưu client connection
    global.progressClient = res;

    // Cleanup khi client disconnect
    req.on('close', () => {
        global.progressClient = null;
    });
});

// Add health check route
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

module.exports = router; 