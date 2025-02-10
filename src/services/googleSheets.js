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
        this.MAX_RETRIES = 2; // Giảm số lần retry
    }

    async readSheet(sheetId, range) {
        try {
            console.log('🔍 Smarttrans reading sheet:', {
                sheetId,
                range,
                timestamp: new Date().toISOString()
            });

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: range || '',
                valueRenderOption: 'UNFORMATTED_VALUE',
                dateTimeRenderOption: 'FORMATTED_STRING'
            });

            if (!response.data.values) {
                console.warn('⚠️ No data found in range:', range || 'entire sheet');
                throw new Error('Không tìm thấy dữ liệu trong sheet');
            }

            return response.data.values;
        } catch (error) {
            console.error('❌ Error reading sheet:', error);
            throw new Error(`Không thể đọc Google Sheet: ${error.message}`);
        }
    }

    async updateSheet(sheetId, range, values, retries = this.MAX_RETRIES) {
        try {
            console.log('📝 Updating sheet:', {
                sheetId,
                range,
                rowCount: values.length,
                columnCount: values[0]?.length,
                retryCount: this.MAX_RETRIES - retries,
                timestamp: new Date().toISOString()
            });

            const response = await this.sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: range,
                valueInputOption: 'RAW',
                requestBody: { values }
            });

            console.log('✅ Sheet updated successfully:', {
                range,
                updatedRows: response.data.updatedRows,
                updatedColumns: response.data.updatedColumns,
                updatedCells: response.data.updatedCells
            });

            await new Promise(resolve => setTimeout(resolve, this.WRITE_DELAY));

        } catch (error) {
            console.error('❌ Update Error:', {
                error: error.message,
                sheetId,
                range,
                retriesLeft: retries
            });
            
            if (retries > 0) {
                console.log('🔄 Retrying update...');
                await new Promise(resolve => setTimeout(resolve, this.WRITE_DELAY));
                return this.updateSheet(sheetId, range, values, retries - 1);
            }
            
            throw new Error(`Error updating Google Sheet: ${error.message}`);
        }
    }

    async getSheetsList(sheetId) {
        try {
            console.log('📋 Fetching sheets list for:', sheetId);
            
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: sheetId
            });

            const sheets = response.data.sheets.map(sheet => ({
                id: sheet.properties.sheetId,
                title: sheet.properties.title
            }));

            console.log('📑 Found sheets:', sheets);
            return sheets;

        } catch (error) {
            console.error('❌ Error getting sheets list:', {
                error: error.message,
                sheetId
            });
            throw new Error(`Không thể lấy danh sách sheets: ${error.message}`);
        }
    }
}

module.exports = new GoogleSheetsService(); 