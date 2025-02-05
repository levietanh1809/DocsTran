const { query } = require('../services/sql');

class Translation {
    static async create(translation) {
        try {
            const result = await query`
                INSERT INTO Translations (DocUrl, SourceLang, TargetLang, Domain)
                VALUES (${translation.docUrl}, ${translation.sourceLang}, 
                        ${translation.targetLang}, ${translation.domain});
                SELECT SCOPE_IDENTITY() AS id;
            `;
            return result.recordset[0].id;
        } catch (error) {
            throw new Error(`Lỗi khi tạo bản dịch: ${error.message}`);
        }
    }

    static async findAll() {
        try {
            const result = await query`
                SELECT TOP 10 *
                FROM Translations
                ORDER BY CreatedAt DESC
            `;
            return result.recordset;
        } catch (error) {
            throw new Error(`Lỗi khi lấy danh sách bản dịch: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            const result = await query`
                SELECT * FROM Translations WHERE Id = ${id}
            `;
            return result.recordset[0];
        } catch (error) {
            throw new Error(`Lỗi khi tìm bản dịch: ${error.message}`);
        }
    }

    static async updateStatus(id, status, errorMessage = null) {
        try {
            await query`
                UPDATE Translations 
                SET Status = ${status}, 
                    ErrorMessage = ${errorMessage}
                WHERE Id = ${id}
            `;
        } catch (error) {
            throw new Error(`Lỗi khi cập nhật trạng thái: ${error.message}`);
        }
    }

    static async updateTranslation(id, translatedText) {
        try {
            await query`
                UPDATE Translations 
                SET Result = ${translatedText},
                    Status = 'completed'
                WHERE Id = ${id}
            `;
        } catch (error) {
            throw new Error(`Error updating translation: ${error.message}`);
        }
    }

    static async processGoogleSheet(sheetRange) {
        try {
            const result = await query`
                INSERT INTO Translations (DocUrl, SourceLang, TargetLang, Domain, Status)
                VALUES ('google_sheet', 'vi', 'en', 'general', 'processing');
                SELECT SCOPE_IDENTITY() AS id;
            `;
            return result.recordset[0].id;
        } catch (error) {
            throw new Error(`Error processing Google Sheet: ${error.message}`);
        }
    }
}

module.exports = Translation; 