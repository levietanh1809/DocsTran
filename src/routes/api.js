const express = require('express');
const router = express.Router();
const translateController = require('../controllers/translateController');
const validateGoogleSheet = require('../middlewares/validateGoogleSheet');

// Existing routes
router.post('/translate-sheet', validateGoogleSheet, translateController.handleSheetTranslation);
router.get('/translation-progress', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    req.app.locals.progressClient = res;
});

// Add new route for models
router.get('/models', async (req, res) => {
    try {
        await translateController.getModels(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Không thể lấy danh sách models'
        });
    }
});

// Existing route for sheets list
router.post('/sheets/list', async (req, res) => {
    try {
        const { sheetUrl } = req.body;
        const sheetId = sheetUrl.match(/\/d\/(.*?)(\/|$)/)?.[1];
        
        if (!sheetId) {
            throw new Error('URL Google Sheet không hợp lệ');
        }

        const sheets = await googleSheets.getSheetsList(sheetId);
        res.json({
            success: true,
            sheets
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 