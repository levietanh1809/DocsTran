// Khi sheet được mở
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('DocTrans')
    .addItem('Mở công cụ dịch', 'showTranslateSidebar')
    .addToUi();
}

// Kiểm tra và yêu cầu quyền
function checkAuthorization() {
  try {
    // Test các quyền cần thiết
    SpreadsheetApp.getActiveSheet(); // Test spreadsheet access
    UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      muteHttpExceptions: true,
      method: 'get'
    }); // Test external request
    return false; // Nếu không có lỗi -> đã có quyền
  } catch (e) {
    // Nếu có lỗi -> cần cấp quyền
    return true;
  }
}

// Hiển thị sidebar
function showTranslateSidebar() {
  // Kiểm tra quyền
  if (checkAuthorization()) {
    // Hiển thị dialog yêu cầu quyền với style
    const template = HtmlService.createTemplate(`
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="p-4">
          <div class="text-center">
            <h5>Yêu cầu cấp quyền</h5>
            <p>Ứng dụng cần được cấp quyền để:</p>
            <ul class="text-start">
              <li>Đọc và ghi dữ liệu trên sheet</li>
              <li>Gọi API dịch thuật</li>
              <li>Hiển thị giao diện</li>
            </ul>
            <button onclick="google.script.run.requestAuthorization()" 
                    class="btn btn-primary">
              Cấp quyền ngay
            </button>
          </div>
        </body>
      </html>
    `);
    const html = template.evaluate()
      .setWidth(400)
      .setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(html, 'Yêu cầu cấp quyền');
    return;
  }

  // Nếu đã được cấp quyền, hiển thị sidebar
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('DocTrans - Công cụ dịch')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Hàm yêu cầu cấp quyền
function requestAuthorization() {
  ScriptApp.newTrigger('onAuthorizationComplete')
    .timeBased()
    .after(1000)
    .create();
    
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  const url = authInfo.getAuthorizationUrl();
  const template = HtmlService.createTemplate(
    '<script>window.top.location.href = "' + url + '";</script>'
  );
  const html = template.evaluate();
  SpreadsheetApp.getUi().showModalDialog(html, 'Đang chuyển hướng...');
}

// Callback sau khi cấp quyền
function onAuthorizationComplete() {
  // Xóa trigger
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if(trigger.getHandlerFunction() === 'onAuthorizationComplete') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Mở lại sidebar
  showTranslateSidebar();
}

// Lấy thông tin về ranges đã chọn
function getSelectedRange() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const selection = sheet.getSelection();
    const range = selection.getActiveRange();
    
    if (!range) return null;
    
    return {
      a1Notation: range.getA1Notation(),
      numRows: range.getNumRows(),
      numColumns: range.getNumColumns()
    };
  } catch (error) {
    console.error('Error getting selected range:', error);
    return null;
  }
}

// Hàm dịch vùng đã chọn
function translateSelectedRange(config) {
  // Kiểm tra quyền trước khi thực hiện
  if (checkAuthorization()) {
    throw new Error('Vui lòng cấp quyền cho ứng dụng để tiếp tục');
  }

  try {
    const {apiKey, targetLang, domain} = config;
    
    if (!apiKey) {
      throw new Error('Vui lòng nhập OpenAI API key');
    }
    
    // Lấy vùng đã chọn
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();
    
    if (!range) {
      throw new Error('Vui lòng chọn vùng cần dịch');
    }
    
    // Lấy dữ liệu từ vùng đã chọn
    const sourceData = range.getValues();
    
    // Khởi tạo OpenAI Service với API key từ form
    const openai = new OpenAIService(apiKey);
    
    // Dịch từng cell
    const translatedData = sourceData.map(row => {
      return row.map(cell => {
        if (!cell) return '';
        return openai.translate(cell, targetLang, domain);
      });
    });
    
    // Ghi kết quả trực tiếp vào vùng đã chọn
    range.setValues(translatedData);
    
    return {
      success: true,
      message: 'Dịch thành công!'
    };
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(error.message || 'Có lỗi xảy ra khi dịch');
  }
}

// Utility functions
function getSheetData() {
  const sheet = SpreadsheetApp.getActiveSheet();
  return {
    name: sheet.getName(),
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn()
  };
} 