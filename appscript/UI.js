// Custom HTML cho dialog
function getTranslateDialogHtml() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body>
        <div class="container p-4">
          <form id="translateForm">
            <div class="mb-3">
              <label class="form-label">Vùng nguồn</label>
              <input type="text" class="form-control" id="sourceRange" required>
              <div class="form-text">VD: A1:A10</div>
            </div>
            
            <div class="mb-3">
              <label class="form-label">Vùng đích</label>
              <input type="text" class="form-control" id="targetRange" required>
              <div class="form-text">VD: B1:B10</div>
            </div>

            <div class="mb-3">
              <label class="form-label">Ngôn ngữ đích</label>
              <select class="form-select" id="targetLang" required>
                <option value="en">Tiếng Anh</option>
                <option value="ja">Tiếng Nhật</option>
                <option value="ko">Tiếng Hàn</option>
                <option value="zh">Tiếng Trung</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label">Lĩnh vực</label>
              <select class="form-select" id="domain" required>
                <option value="technical">Kỹ thuật</option>
                <option value="general">Chung</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary w-100">
              Bắt đầu dịch
            </button>
          </form>
        </div>

        <script>
          document.getElementById('translateForm').onsubmit = function(e) {
            e.preventDefault();
            google.script.run
              .withSuccessHandler(onSuccess)
              .withFailureHandler(onFailure)
              .translateSheet({
                sourceRange: document.getElementById('sourceRange').value,
                targetRange: document.getElementById('targetRange').value,
                targetLang: document.getElementById('targetLang').value,
                domain: document.getElementById('domain').value
              });
          }

          function onSuccess() {
            alert('Dịch thành công!');
          }

          function onFailure(error) {
            alert('Có lỗi xảy ra: ' + error);
          }
        </script>
      </body>
    </html>
  `;
} 