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

## 3. Cài đặt và Sử dụng

### 3.1. Yêu cầu hệ thống
- Node.js 18+
- SQL Server 2019
- Git

### 3.2. Cài đặt môi trường development
```bash
# Clone repository
git clone xxx
cd doctrans

# Cài đặt dependencies
npm install

# Tạo và cấu hình .env
cp .env.example .env
```

### 3.3. Khởi tạo database
1. Tạo database TranslateApp trong SQL Server
2. Chạy script database.sql để tạo schema và tables

### 3.4. Chạy ứng dụng
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 4. Troubleshooting

### 4.1. Kiểm tra kết nối database
```javascript
const sql = require('mssql');
sql.connect(process.env.DB_CONNECTION_STRING)
  .then(() => console.log('Connected!'))
  .catch(err => console.error('Connection failed:', err))
```

### 4.2. Reset database
1. Xóa database hiện tại
2. Tạo lại database mới
3. Chạy lại script database.sql

## 5. Security Notes
1. Đặt mật khẩu mạnh cho database
2. Giới hạn quyền truy cập API
3. Regular security updates
4. Monitoring bất thường

## Support
Liên hệ tác giả qua email: anh.leviet@vti.com.vn
