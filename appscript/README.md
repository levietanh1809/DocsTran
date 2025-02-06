# DocTrans Google Apps Script

Ứng dụng dịch thuật tích hợp trực tiếp vào Google Sheets sử dụng OpenAI API.

## Cài đặt

1. Mở Google Sheet cần sử dụng
2. Vào Extensions > Apps Script
3. Copy nội dung các file trong thư mục này vào Apps Script Editor
4. Lưu và Refresh Google Sheet

## Cấu hình

1. Vào Project Settings trong Apps Script Editor
2. Thêm Script Property:
   - OPENAI_API_KEY: API key của OpenAI

## Sử dụng

1. Menu DocTrans sẽ xuất hiện trên Google Sheet
2. Click "Bắt đầu dịch" để mở dialog cấu hình
3. Nhập thông tin:
   - Vùng nguồn: Cells chứa text cần dịch
   - Vùng đích: Cells sẽ chứa bản dịch
   - Ngôn ngữ đích: Ngôn ngữ cần dịch sang
   - Lĩnh vực: Loại văn bản để tối ưu chất lượng dịch
4. Click "Bắt đầu dịch"

## Lưu ý

- Đảm bảo vùng nguồn và đích có cùng kích thước
- API key phải còn hiệu lực và đủ credits
- Tránh dịch quá nhiều cells cùng lúc để tránh timeout 