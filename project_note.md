# DocTrans - Ứng dụng dịch thuật tài liệu

## Thông tin dự án
**Tác giả:** Lê Việt Anh  
**Email:** anh.leviet@vti.com.vn  
**Version:** 1.0.0  
**License:** MIT

## 1. Tổng quan
DocTrans là ứng dụng web cho phép dịch nội dung từ Google Sheets sang nhiều ngôn ngữ (Anh, Nhật, Hàn, Trung) sử dụng OpenAI API. Ứng dụng hỗ trợ nhiều lĩnh vực dịch thuật và theo dõi tiến độ realtime.

## 2. Công nghệ sử dụng
- **Backend:** Node.js, Express.js
- **Frontend:** EJS, Bootstrap 5
- **Database:** SQL Server 2019
- **APIs:** OpenAI API, Google Sheets API
- **Others:** Docker, Nginx

## 3. Cài đặt chi tiết

### 3.1. Cài đặt môi trường
```bash
# 1. Cài đặt Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Cài đặt SQL Server 2019
# Tham khảo: https://docs.microsoft.com/en-us/sql/linux/quickstart-install-connect-ubuntu

# 3. Clone repository
git clone https://github.com/yourusername/doctrans.git
cd doctrans

# 4. Cài đặt dependencies
npm install

# 5. Tạo và cấu hình .env
cp .env.example .env
```

### 3.2. Cấu hình Database
1. Tạo database và user:
```sql
CREATE DATABASE TranslateApp;
CREATE LOGIN doctrans WITH PASSWORD = 'your_password';
USE TranslateApp;
CREATE USER doctrans FOR LOGIN doctrans;
EXEC sp_addrolemember 'db_owner', 'doctrans';
```

2. Import schema:
```bash
# Sử dụng SQL Server Management Studio hoặc Azure Data Studio
# Import file database.sql
```

### 3.3. Cấu hình Google API
1. Tạo Service Account trong Google Cloud Console
2. Enable Google Sheets API
3. Tạo key và download credentials.json
4. Cập nhật .env với thông tin credentials

### 3.4. Cấu hình OpenAI API
1. Đăng ký tài khoản OpenAI
2. Tạo API key
3. Cập nhật OPENAI_API_KEY trong .env

## 4. Giải thích source code

### 4.1. Controllers
- **translateController.js**
  - handleSheetTranslation: Xử lý dịch từ Google Sheet
  - Sử dụng batch processing để tối ưu performance
  - Progress tracking qua Server-Sent Events

- **projectController.js**
  - Quản lý projects và translations
  - Thống kê và báo cáo

### 4.2. Services
- **googleSheets.js**
  - Kết nối Google Sheets API
  - Xử lý đọc/ghi sheet
  - Rate limiting và retry logic

- **openai.js**
  - Kết nối OpenAI API
  - Custom prompts theo domain
  - Error handling và retry logic

### 4.3. Middlewares
- **validateGoogleSheet.js**
  - Validate sheet URL
  - Validate range format (A1:B10, A:A, 1:10)
  - Kiểm tra quyền truy cập

### 4.4. Database Schema
```sql
Projects
  - Id (PK)
  - Name
  - Description
  - CreatedAt
  - UpdatedAt

TranslationSources
  - Id (PK)
  - ProjectId (FK)
  - Type
  - SourceUrl
  - SheetRange

Translations
  - Id (PK)
  - SourceId (FK)
  - SourceText
  - TranslatedText
  - Status
```

## 5. Deployment

### 5.1. Development
```bash
npm run dev
```

### 5.2. Production với PM2
```bash
# Cài đặt PM2
npm install -g pm2

# Start application
pm2 start src/index.js --name doctrans

# Auto-restart on reboot
pm2 startup
pm2 save
```

### 5.3. Docker Deployment
```bash
# Build và run
docker-compose up -d

# Check logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale app=2
```

## 6. Monitoring & Maintenance

### 6.1. Logs
- Application logs: `logs/app.log`
- Error logs: `logs/error.log`
- Access logs: Nginx logs

### 6.2. Backup
```bash
# Database backup
mysqldump -u user -p TranslateApp > backup.sql

# Restore
mysql -u user -p TranslateApp < backup.sql
```

### 6.3. Security
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection

## 7. Known Issues & TODOs
1. Cải thiện performance khi xử lý file lớn
2. Thêm unit tests
3. Implement caching layer
4. Thêm tính năng export/import
5. Tối ưu chi phí API

## Support
Liên hệ tác giả qua email: anh.leviet@vti.com.vn
