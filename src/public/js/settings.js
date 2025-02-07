// Load settings khi trang được load
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
});

// Load settings từ localStorage
function loadSettings() {
    const apiKey = localStorage.getItem('openai_api_key');
    if (apiKey) {
        document.getElementById('apiKey').value = apiKey;
    }
}

// Lưu settings vào localStorage
function saveSettings() {
    const apiKey = document.getElementById('apiKey').value;
    
    // Validate API key nếu có nhập
    if (apiKey) {
        if (!apiKey.match(/^sk-[a-zA-Z0-9_-]{32,}$/)) {
            showAlert('danger', 'API key không hợp lệ. API key phải bắt đầu bằng "sk-" và có ít nhất 32 ký tự.');
            return;
        }
        
        // Test API key
        showAlert('info', 'Đang kiểm tra API key...');
        
        fetch('/api/validate-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey })
        })
        .then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            return res.json();
        })
        .then(data => {
            if (data.success) {
                localStorage.setItem('openai_api_key', apiKey);
                const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                modal.hide();
                showAlert('success', 'Đã lưu API key thành công');
            } else {
                showAlert('danger', data.error || 'API key không hợp lệ');
            }
        })
        .catch(err => {
            console.error('Validate key error:', err);
            showAlert('danger', 'Không thể kiểm tra API key. Vui lòng thử lại sau.');
        });
    } else {
        // Xóa API key khỏi localStorage nếu không nhập
        localStorage.removeItem('openai_api_key');
        const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        modal.hide();
        showAlert('success', 'Đã xóa API key, hệ thống sẽ sử dụng API key mặc định');
    }
}

// Toggle API key visibility
function toggleApiKeyVisibility(button) {
    const input = document.getElementById('apiKey');
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}

function showAlert(type, message) {
    const alertsContainer = document.getElementById('globalAlerts');
    
    // Tạo alert mới
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show d-flex align-items-center shadow-sm`;
    
    // Thêm icon tương ứng với loại alert
    let icon = 'info-circle';
    switch(type) {
        case 'success':
            icon = 'check-circle';
            break;
        case 'danger':
            icon = 'exclamation-circle';
            break;
        case 'warning':
            icon = 'exclamation-triangle';
            break;
    }
    
    alertDiv.innerHTML = `
        <div class="d-flex w-100 align-items-center">
            <i class="bi bi-${icon} me-2 fs-5"></i>
            <div class="flex-grow-1">${message}</div>
            <button type="button" class="btn-close ms-3" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Thêm vào container
    alertsContainer.appendChild(alertDiv);
    
    // Auto hide sau 5 giây
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
} 