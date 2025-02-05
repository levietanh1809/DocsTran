console.log('Form script loaded');

// Add to existing form-validation.js or create new file
document.getElementById('sheetTranslateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    form.classList.add('was-validated');

    // Kiểm tra form validation
    if (!form.checkValidity()) {
        console.log('Form validation failed');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const spinner = submitBtn.querySelector('.spinner-border');
    const btnText = submitBtn.querySelector('.button-text');
    const progressBar = submitBtn.querySelector('.progress-bar');
    const progressDetail = document.getElementById('progressDetail');
    const progressDiv = document.getElementById('translationProgress');
    const mainProgressBar = progressDiv.querySelector('.progress-bar');
    
    // Reset và hiện progress bars
    [progressBar, mainProgressBar].forEach(bar => {
        bar.style.width = '0%';
        bar.setAttribute('aria-valuenow', 0);
    });
    submitBtn.classList.add('processing');
    progressDiv.classList.remove('d-none');

    try {
        // Thay đổi trạng thái button và progress
        submitBtn.disabled = true;
        spinner.classList.remove('d-none');
        btnText.textContent = 'Đang chuẩn bị...';
        progressDetail.textContent = 'Đang khởi tạo dự án...';

        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Tạo EventSource để nhận updates
        const eventSource = new EventSource('/api/translation-progress');
        
        eventSource.onmessage = (event) => {
            const progress = JSON.parse(event.data);
            
            // Cập nhật cả 2 progress bars
            [progressBar, mainProgressBar].forEach(bar => {
                bar.style.width = `${progress.percent}%`;
                bar.setAttribute('aria-valuenow', progress.percent);
            });

            // Cập nhật text hiển thị
            btnText.textContent = `Đang xử lý (${progress.percent}%)`;
            document.getElementById('progressText').textContent = `${progress.percent}%`;
            progressDetail.textContent = progress.detail || `Đã dịch ${progress.percent}%`;

            // Thêm class khi hoàn thành
            if (progress.percent === 100) {
                eventSource.close();
                [progressBar, mainProgressBar].forEach(bar => {
                    bar.classList.add('bg-success');
                });
                progressDetail.textContent = 'Hoàn thành dịch thuật!';
            }
        };

        const response = await fetch('/api/translate-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            showAlert('success', result.message);
            
            // Hiển thị thông tin chi phí và thống kê
            const costEstimate = document.getElementById('costEstimate');
            if (costEstimate && result.stats) {
                // Định dạng số với dấu phẩy ngăn cách hàng nghìn
                const formatNumber = (num) => num.toLocaleString();
                
                costEstimate.innerHTML = `
                    <div class="border-start border-success ps-3">
                        <div class="text-success fw-bold mb-2">
                            <i class="bi bi-check-circle-fill me-1"></i>
                            Hoàn thành dịch thuật!
                        </div>
                        <div class="text-muted">
                            <div class="mb-1">
                                <i class="bi bi-grid me-2"></i>
                                <span class="fw-medium">Số ô đã dịch:</span> ${formatNumber(result.stats.totalCells)}
                            </div>
                            <div class="mb-1">
                                <i class="bi bi-text-paragraph me-2"></i>
                                <span class="fw-medium">Tổng ký tự:</span> ${formatNumber(result.stats.totalChars)}
                            </div>
                            <div class="mb-1">
                                <i class="bi bi-robot me-2"></i>
                                <span class="fw-medium">Model:</span> ${result.stats.model}
                            </div>
                            <div class="mb-2">
                                <i class="bi bi-currency-dollar me-2"></i>
                                <span class="fw-medium">Tổng chi phí:</span> ${result.stats.estimatedCost}
                            </div>
                            <div class="small text-muted border-top pt-2">
                                <div>Input (${formatNumber(result.stats.details.inputTokens)} tokens): ${result.stats.details.inputCost}</div>
                                <div>Output (${formatNumber(result.stats.details.outputTokens)} tokens): ${result.stats.details.outputCost}</div>
                                <div class="mt-1">
                                    <i class="bi bi-info-circle-fill me-1"></i>
                                    Giá: ${result.stats.details.inputRate} (input), ${result.stats.details.outputRate} (output)
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // Thêm class để hiển thị box hoàn thành
                const progressDiv = document.getElementById('translationProgress');
                progressDiv.classList.add('completed');
            }

            // Cập nhật trạng thái hoàn thành
            const progressDetail = document.getElementById('progressDetail');
            progressDetail.innerHTML = `
                <i class="bi bi-check-circle-fill text-success me-1"></i>
                Đã hoàn thành dịch thuật!
            `;
            
            // Reset button state
            const submitBtn = document.querySelector('button[type="submit"]');
            const spinner = submitBtn.querySelector('.spinner-border');
            const btnText = submitBtn.querySelector('.button-text');
            
            submitBtn.disabled = false;
            spinner.classList.add('d-none');
            btnText.textContent = 'Bắt đầu dịch';
            submitBtn.classList.remove('processing');

        } else {
            showAlert('danger', result.error || 'Có lỗi xảy ra');
            // Reset UI khi có lỗi
            resetUI();
        }

    } catch (error) {
        console.error('Request error:', error);
        showAlert('danger', 'Không thể kết nối đến server');
    }
});

// Tách hàm reset UI ra riêng
function resetUI() {
    const submitBtn = document.querySelector('button[type="submit"]');
    const spinner = submitBtn.querySelector('.spinner-border');
    const btnText = submitBtn.querySelector('.button-text');
    const progressDiv = document.getElementById('translationProgress');
    const progressDetail = document.getElementById('progressDetail');
    const progressBar = submitBtn.querySelector('.progress-bar');
    const mainProgressBar = progressDiv.querySelector('.progress-bar');

    submitBtn.disabled = false;
    spinner.classList.add('d-none');
    btnText.textContent = 'Bắt đầu dịch';
    submitBtn.classList.remove('processing');
    
    // Ẩn progress bars với animation
    [progressBar, mainProgressBar].forEach(bar => {
        bar.style.transition = 'width 0.5s ease';
        bar.style.width = '0%';
        bar.classList.remove('bg-success');
    });

    // Ẩn progress div và reset text
    progressDiv.classList.add('d-none');
    progressDetail.textContent = 'Đang chuẩn bị...';
}

// Cải thiện hàm showAlert để hiển thị thông báo đẹp hơn
function showAlert(type, message) {
    // Xóa alert cũ nếu có
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Tạo alert mới với animation
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Thêm alert vào body
    document.body.appendChild(alertDiv);
    
    // Auto hide sau 5 giây với animation
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
}

// Thêm event listener cho input URL
document.getElementById('sheetUrl').addEventListener('change', async function(e) {
    const url = e.target.value;
    const sheetSelect = document.getElementById('sheetName');
    
    if (!url) {
        sheetSelect.disabled = true;
        sheetSelect.innerHTML = '<option value="" selected disabled>Nhập URL Google Sheet trước</option>';
        return;
    }

    try {
        // Hiển thị loading state
        sheetSelect.disabled = true;
        sheetSelect.innerHTML = '<option value="" selected disabled>Đang tải danh sách sheets...</option>';

        // Gọi API để lấy danh sách sheets
        const response = await fetch('/api/sheets/list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sheetUrl: url })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Không thể lấy danh sách sheets');
        }

        // Cập nhật dropdown
        sheetSelect.innerHTML = '<option value="" selected disabled>Chọn sheet...</option>';
        result.sheets.forEach(sheet => {
            const option = document.createElement('option');
            option.value = sheet.title;
            option.textContent = sheet.title;
            sheetSelect.appendChild(option);
        });
        sheetSelect.disabled = false;

    } catch (error) {
        console.error('Error loading sheets:', error);
        sheetSelect.innerHTML = '<option value="" selected disabled>Lỗi: ' + error.message + '</option>';
    }
});

// Thêm function copy email
function copyEmail() {
    navigator.clipboard.writeText('anh.leviet@vti.com.vn')
        .then(() => {
            // Có thể thêm toast hoặc alert để thông báo đã copy
            const btn = document.querySelector('[onclick="copyEmail()"]');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check"></i>';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
        });
}

// Form step handling
function updateProgress(step) {
    const percent = ((step - 1) / 2) * 100;
    document.getElementById('formProgress').style.width = `${percent}%`;
    
    // Update badges
    document.querySelectorAll('.step-badge').forEach(badge => {
        const badgeStep = parseInt(badge.dataset.step);
        if (badgeStep === step) {
            badge.classList.replace('text-bg-secondary', 'text-bg-primary');
        } else if (badgeStep < step) {
            badge.classList.replace('text-bg-secondary', 'text-bg-success');
        } else {
            badge.classList.replace('text-bg-primary', 'text-bg-secondary');
            badge.classList.replace('text-bg-success', 'text-bg-secondary');
        }
    });
}

function showStep(step) {
    document.querySelectorAll('.step-content').forEach(content => {
        if (parseInt(content.dataset.step) === step) {
            content.classList.remove('d-none');
            content.style.opacity = '1';
        } else {
            content.style.opacity = '0';
            setTimeout(() => content.classList.add('d-none'), 300);
        }
    });
    updateProgress(step);
}

function validateStep(step) {
    const content = document.querySelector(`.step-content[data-step="${step}"]`);
    const inputs = content.querySelectorAll('input[required], select[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value) {
            isValid = false;
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
    });
    
    return isValid;
}

function nextStep(step) {
    if (validateStep(step - 1)) {
        showStep(step);
    }
}

function prevStep(step) {
    showStep(step);
}

// Load models khi trang load
async function loadModels() {
    const modelSelect = document.getElementById('model');
    const modelPricing = document.getElementById('modelPricing');
    
    try {
        const response = await fetch('/api/models');
        const result = await response.json();
        
        if (response.ok && result.success) {
            modelSelect.innerHTML = '<option value="" selected disabled>Chọn model...</option>';
            
            result.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                option.dataset.pricing = JSON.stringify(model.pricing);
                modelSelect.appendChild(option);
            });

            // Thêm event listener để hiển thị giá
            modelSelect.addEventListener('change', function() {
                const selected = this.options[this.selectedIndex];
                if (selected.dataset.pricing) {
                    const pricing = JSON.parse(selected.dataset.pricing);
                    modelPricing.innerHTML = `
                        <div class="text-muted">
                            <div>Input: $${pricing.input}/1K tokens</div>
                            <div>Output: $${pricing.output}/1K tokens</div>
                        </div>
                    `;
                }
            });
        }
    } catch (error) {
        console.error('Error loading models:', error);
        modelSelect.innerHTML = '<option value="" selected disabled>Lỗi: Không thể tải danh sách models</option>';
    }
}

// Gọi function khi trang load
document.addEventListener('DOMContentLoaded', loadModels);

// Thêm validation cho range input
const rangeInput = document.getElementById('sheetRange');
if (rangeInput) {
    function validateRange(value) {
        // Reset validation state khi input trống
        if (!value || value.trim() === '') {
            return '';
        }

        try {
            const range = value.trim().toUpperCase();

            // Kiểm tra có dấu :
            if (!range.includes(':')) {
                throw new Error('Định dạng vùng dữ liệu không hợp lệ');
            }

            const [start, end] = range.split(':');

            // Kiểm tra format cột (D:D)
            const columnFormat = /^[A-Z]$/;
            if (columnFormat.test(start) && columnFormat.test(end)) {
                // Kiểm tra thứ tự cột
                if (start.charCodeAt(0) > end.charCodeAt(0)) {
                    throw new Error('Cột bắt đầu phải nhỏ hơn hoặc bằng cột kết thúc');
                }
                return '';
            }

            // Kiểm tra format dòng (14:14)
            const rowFormat = /^\d+$/;
            if (rowFormat.test(start) && rowFormat.test(end)) {
                // Kiểm tra thứ tự dòng
                if (parseInt(start) > parseInt(end)) {
                    throw new Error('Dòng bắt đầu phải nhỏ hơn hoặc bằng dòng kết thúc');
                }
                return '';
            }

            // Kiểm tra format đầy đủ (A2:A10)
            const cellFormat = /^[A-Z]+\d+$/;
            if (cellFormat.test(start) && cellFormat.test(end)) {
                // Tách cột và dòng
                const startCol = start.match(/^[A-Z]+/)[0];
                const startRow = parseInt(start.match(/\d+$/)[0]);
                const endCol = end.match(/^[A-Z]+/)[0];
                const endRow = parseInt(end.match(/\d+$/)[0]);

                // Kiểm tra thứ tự
                if (startCol > endCol || startRow > endRow) {
                    throw new Error('Vùng chọn không hợp lệ (cột/dòng bắt đầu phải nhỏ hơn hoặc bằng cột/dòng kết thúc)');
                }
                return '';
            }

            throw new Error('Định dạng vùng dữ liệu không hợp lệ');
        } catch (error) {
            return `${error.message} (VD: A2:A10, D:D, 14:14)`;
        }
    }

    // Validate khi input thay đổi
    rangeInput.addEventListener('input', function() {
        const errorMessage = validateRange(this.value);
        this.setCustomValidity(errorMessage);
    });

    // Validate khi blur
    rangeInput.addEventListener('blur', function() {
        const errorMessage = validateRange(this.value);
        this.setCustomValidity(errorMessage);
    });
} 