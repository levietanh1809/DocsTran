-- Thêm vào đầu file
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'TranslateApp')
BEGIN
    CREATE DATABASE TranslateApp;
END
GO

USE TranslateApp;
GO

-- Tạo bảng Projects nếu chưa tồn tại
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND type in (N'U'))
BEGIN
    CREATE TABLE Projects (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created table Projects';
END
GO

-- Tạo bảng TranslationSources
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TranslationSources]') AND type in (N'U'))
BEGIN
    CREATE TABLE TranslationSources (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ProjectId INT,
        Type VARCHAR(20) NOT NULL,
        SourceUrl NVARCHAR(500) NOT NULL,
        SheetRange NVARCHAR(50),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_TranslationSources_Projects FOREIGN KEY (ProjectId) REFERENCES Projects(Id),
        CONSTRAINT CHK_SourceType CHECK (Type IN ('google_doc', 'google_sheet'))
    );
END
GO

-- Tạo bảng Translations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Translations]') AND type in (N'U'))
BEGIN
    CREATE TABLE Translations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SourceId INT NOT NULL,
        SourceText NVARCHAR(MAX) NOT NULL,
        TranslatedText NVARCHAR(MAX),
        SourceLang VARCHAR(10) NOT NULL DEFAULT 'vi',
        TargetLang VARCHAR(10) NOT NULL,
        Domain VARCHAR(50) NOT NULL DEFAULT 'general',
        Status VARCHAR(20) DEFAULT 'pending',
        ErrorMessage NVARCHAR(MAX),
        TranslatedAt DATETIME,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Translations_Sources FOREIGN KEY (SourceId) REFERENCES TranslationSources(Id),
        CONSTRAINT CHK_SourceLang CHECK (SourceLang IN ('en', 'vi', 'ja', 'ko', 'zh')),
        CONSTRAINT CHK_TargetLang CHECK (TargetLang IN ('en', 'vi', 'ja', 'ko', 'zh')),
        CONSTRAINT CHK_Domain CHECK (Domain IN ('general', 'technical', 'medical', 'legal', 'business')),
        CONSTRAINT CHK_Status CHECK (Status IN ('pending', 'processing', 'completed', 'failed'))
    );
END
GO

-- Tạo bảng TranslationHistory (Lịch sử dịch)
CREATE TABLE TranslationHistory (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TranslationId INT NOT NULL,
    Action VARCHAR(50) NOT NULL,
    Details NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_History_Translations FOREIGN KEY (TranslationId) REFERENCES Translations(Id)
);
GO

-- Tạo các triggers
-- 1. Trigger cập nhật UpdatedAt cho Projects
CREATE TRIGGER TR_Projects_UpdatedAt
ON Projects
AFTER UPDATE
AS
BEGIN
    UPDATE Projects
    SET UpdatedAt = GETDATE()
    FROM Projects p
    INNER JOIN inserted i ON p.Id = i.Id;
END;
GO

-- 2. Trigger cập nhật UpdatedAt cho TranslationSources
CREATE TRIGGER TR_TranslationSources_UpdatedAt
ON TranslationSources
AFTER UPDATE
AS
BEGIN
    UPDATE TranslationSources
    SET UpdatedAt = GETDATE()
    FROM TranslationSources t
    INNER JOIN inserted i ON t.Id = i.Id;
END;
GO

-- 3. Trigger cập nhật UpdatedAt cho Translations
CREATE TRIGGER TR_Translations_UpdatedAt
ON Translations
AFTER UPDATE
AS
BEGIN
    UPDATE Translations
    SET UpdatedAt = GETDATE()
    FROM Translations t
    INNER JOIN inserted i ON t.Id = i.Id;
END;
GO

-- 4. Trigger tạo history khi có thay đổi trạng thái Translation
CREATE TRIGGER TR_Translations_History
ON Translations
AFTER UPDATE
AS
BEGIN
    IF UPDATE(Status)
    BEGIN
        INSERT INTO TranslationHistory (TranslationId, Action, Details)
        SELECT 
            i.Id,
            'StatusChanged',
            CONCAT('Status changed from ', d.Status, ' to ', i.Status)
        FROM inserted i
        INNER JOIN deleted d ON i.Id = d.Id
        WHERE i.Status <> d.Status;
    END
END;
GO

-- Tạo stored procedures
-- 1. SP lấy thông tin chi tiết của một bản dịch
CREATE PROCEDURE sp_GetTranslationDetails
    @TranslationId INT
AS
BEGIN
    SELECT 
        t.*,
        ts.Type AS SourceType,
        ts.SourceUrl,
        ts.SheetRange,
        p.Name AS ProjectName
    FROM Translations t
    INNER JOIN TranslationSources ts ON t.SourceId = ts.Id
    INNER JOIN Projects p ON ts.ProjectId = p.Id
    WHERE t.Id = @TranslationId;
END;
GO

-- 2. SP lấy lịch sử dịch thuật của một project
CREATE PROCEDURE sp_GetProjectTranslationHistory
    @ProjectId INT
AS
BEGIN
    SELECT 
        t.*,
        th.Action,
        th.Details,
        th.CreatedAt AS HistoryDate
    FROM Projects p
    INNER JOIN TranslationSources ts ON p.Id = ts.ProjectId
    INNER JOIN Translations t ON ts.Id = t.SourceId
    INNER JOIN TranslationHistory th ON t.Id = th.TranslationId
    WHERE p.Id = @ProjectId
    ORDER BY th.CreatedAt DESC;
END;
GO 