const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

class GoogleSheetsService {
    constructor() {
        this.auth = new GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.WRITE_DELAY = 50; // Giảm delay xuống 50ms
        this.MAX_RETRIES = 3;
        this.BATCH_SIZE = 20; // Tăng batch size cho việc ghi
    }

    async readSheet(sheetId, range) {
        try {
            console.log(`Reading sheet ${sheetId}, range: ${range}`);
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: range
            });

            console.log('Google Sheets API Response:', {
                range: response.data.range,
                values: response.data.values ? `${response.data.values.length} rows` : 'No values'
            });

            return response.data.values || [];
        } catch (error) {
            console.error('Google Sheets Read Error:', error);
            throw new Error(`Không thể đọc Google Sheet: ${error.message}`);
        }
    }

    async updateSheet(sheetId, range, values, retries = this.MAX_RETRIES) {
        try {
            console.log('Updating sheet:', { sheetId, range, values });
            
            // Validate range format
            if (!range.includes('!')) {
                throw new Error('Invalid range format');
            }

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: { values: [values] }
            });

            console.log(`Updated sheet successfully at range: ${range}`);
            
            // Thêm delay ngắn sau khi write thành công
            await new Promise(resolve => setTimeout(resolve, this.WRITE_DELAY));
            
        } catch (error) {
            console.error('Google Sheets Update Error:', error);
            
            if (retries > 0) {
                console.log(`Retrying update... (${retries} retries left)`);
                // Tăng delay mỗi lần retry
                await new Promise(resolve => setTimeout(resolve, this.WRITE_DELAY * (this.MAX_RETRIES - retries + 1)));
                return this.updateSheet(sheetId, range, values, retries - 1);
            }
            
            throw new Error(`Error updating Google Sheet: ${error.message}`);
        }
    }

    async getSheetsList(sheetId) {
        try {
            console.log('Getting sheets list for:', sheetId);
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: sheetId
            });
            return response.data.sheets.map(sheet => ({
                id: sheet.properties.sheetId,
                title: sheet.properties.title
            }));
        } catch (error) {
            console.error('Error getting sheets list:', error);
            throw new Error(`Không thể lấy danh sách sheets: ${error.message}`);
        }
    }

    // Cải thiện hàm batchUpdate
    async batchUpdate(sheetId, updates) {
        try {
            // Chia nhỏ updates thành các batch nhỏ hơn
            const batches = [];
            for (let i = 0; i < updates.length; i += this.BATCH_SIZE) {
                batches.push(updates.slice(i, i + this.BATCH_SIZE));
            }

            // Xử lý từng batch
            for (const batch of batches) {
                const data = batch.map(({ range, values }) => ({
                    range,
                    values: [values]
                }));

                await this.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: sheetId,
                    resource: {
                        valueInputOption: 'RAW',
                        data: data
                    }
                });

                // Thêm delay ngắn giữa các batch
                await new Promise(resolve => setTimeout(resolve, this.WRITE_DELAY));
            }

            return { success: true };
        } catch (error) {
            console.error('Batch update error:', error);
            throw error;
        }
    }
}

module.exports = new GoogleSheetsService(); 

// Xử lý range input
function parseRange(range) {
    if (!range) {
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

    // Case 1: Column range (e.g., "D:D" or "A:C")
    const columnRangeMatch = range.match(/^([A-Z]):([A-Z])$/);
    if (columnRangeMatch) {
        const [, startCol, endCol] = columnRangeMatch;
        return {
            type: 'column',
            startCol,
            endCol,
            startRow: 1,
            endRow: 1000 // Số dòng mặc định
        };
    }

    // Case 2: Row range (e.g., "1:10")
    const rowRangeMatch = range.match(/^(\d+):(\d+)$/);
    if (rowRangeMatch) {
        const [, startRow, endRow] = rowRangeMatch;
        return {
            type: 'row',
            startCol: 'A',
            endCol: 'Z',
            startRow: parseInt(startRow),
            endRow: parseInt(endRow)
        };
    }

    // Case 3: Full range (e.g., "A2:A10")
    const fullRangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (fullRangeMatch) {
        const [, startCol, startRow, endCol, endRow] = fullRangeMatch;
        return {
            type: 'full',
            startCol,
            startRow: parseInt(startRow),
            endCol,
            endRow: parseInt(endRow)
        };
    }

    // Log để debug
    console.log('Range parsing:', {
        input: range,
        columnMatch: range.match(/^([A-Z]):([A-Z])$/),
        rowMatch: range.match(/^(\d+):(\d+)$/),
        fullMatch: range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
    });

    throw new Error('Range không đúng định dạng. Ví dụ hợp lệ: A2:A10, D:D, 1:10');
}

// Trong hàm getSheetData
async function getSheetData(sheetUrl, sheetName, range = '') {
    try {
        const auth = await authorize();
        const sheets = google.sheets({ version: 'v4', auth });

        // Parse spreadsheet ID from URL
        const spreadsheetId = extractSpreadsheetId(sheetUrl);
        
        // Parse range
        const parsedRange = parseRange(range);
        console.log('Parsed range:', parsedRange);

        // Tạo range string cho API
        let rangeString = sheetName;
        if (parsedRange.type === 'column') {
            rangeString += `!${parsedRange.startCol}:${parsedRange.endCol}`;
        } else if (parsedRange.type === 'row') {
            rangeString += `!${parsedRange.startRow}:${parsedRange.endRow}`;
        } else {
            rangeString += `!${parsedRange.startCol}${parsedRange.startRow}:${parsedRange.endCol}${parsedRange.endRow}`;
        }

        console.log('Final range string:', rangeString);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: rangeString,
            valueRenderOption: 'UNFORMATTED_VALUE'
        });

        return response.data.values || [];
    } catch (error) {
        console.error('Error reading sheet:', error);
        throw error;
    }
} 