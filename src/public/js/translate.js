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
        btnText.textContent = window.translations.translate.button_states.processing;
        progressDetail.textContent = window.translations.translate.progress.preparing;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Tạo EventSource để nhận updates
        const eventSource = new EventSource('/api/translation-progress');
        
        eventSource.onmessage = (event) => {
            try {
                const progress = JSON.parse(event.data);
                console.log('Progress update:', progress);
                
                // Cập nhật progress bars
                const percent = progress.percent || 0;
                [progressBar, mainProgressBar].forEach(bar => {
                    bar.style.width = `${percent}%`;
                    bar.setAttribute('aria-valuenow', percent);
                    
                    // Cập nhật text hiển thị phần trăm
                    const progressText = bar.querySelector('#progressText');
                    if (progressText) {
                        progressText.textContent = `${Math.round(percent)}%`;
                    }
                    
                    // Thêm class khi hoàn thành
                    if (progress.status === 'completed') {
                        bar.classList.add('bg-success');
                    }
                });

                // Cập nhật text theo trạng thái
                if (progress.status === 'completed') {
                    progressDetail.textContent = window.translations.translate.progress.completed;
                    btnText.textContent = window.translations.translate.button_states.submit;
                } else {
                    // Thay thế các placeholder trong message
                    let message = progress.detail;
                    if (message.includes('batch')) {
                        const [current, total] = message.match(/\d+/g);
                        message = window.translations.translate.progress.batch_progress
                            .replace('{current}', current)
                            .replace('{total}', total);
                    } else if (message.includes('dòng')) {
                        const [completed, total, percent] = message.match(/\d+/g);
                        message = window.translations.translate.progress.row_progress
                            .replace('{completed}', completed)
                            .replace('{total}', total)
                            .replace('{percent}', Math.round(percent));
                    } else {
                        message = window.translations.translate.progress.processing;
                    }
                    progressDetail.textContent = message;
                    btnText.textContent = `${window.translations.translate.button_states.processing} (${Math.round(percent)}%)`;
                }

                // Thêm class khi hoàn thành
                if (progress.status === 'completed') {
                    progressDiv.classList.add('completed');
                    eventSource.close();
                }
            } catch (error) {
                console.error('Error parsing progress:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            eventSource.close();
        };

        const response = await fetch('/api/translate-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            handleTranslationSuccess(result);
        } else {
            showError(result.error || 'Có lỗi xảy ra');
            // Reset UI khi có lỗi
            resetUI();
        }

    } catch (error) {
        console.error('Request error:', error);
        showError('Không thể kết nối đến server');
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
    btnText.textContent = window.translations.translate.button_states.submit;
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

            // Kiểm tra format cho 1 ô (VD: A1, B5)
            const singleCellFormat = /^[A-Z]+\d+$/;
            if (singleCellFormat.test(range)) {
                return '';
            }

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
            return `${error.message} (VD: A1, A2:A10, D:D, 14:14)`;
        }
    }

    // Validate range khi input thay đổi
    rangeInput.addEventListener('input', function() {
        try {
            const errorMessage = validateRange(this.value);
            this.setCustomValidity(errorMessage);
            
            // Hiển thị feedback trực tiếp
            const feedback = this.nextElementSibling;
            if (!feedback) {
                const div = document.createElement('div');
                div.className = 'invalid-feedback';
                this.parentNode.appendChild(div);
            }
            
            const feedbackEl = feedback || this.nextElementSibling;
            if (errorMessage) {
                feedbackEl.textContent = errorMessage;
                this.classList.add('is-invalid');
                feedbackEl.style.display = 'block';
            } else {
                this.classList.remove('is-invalid');
                feedbackEl.style.display = 'none';
            }
        } catch (error) {
            this.setCustomValidity(error.message);
        }
    });

    // Validate khi blur
    rangeInput.addEventListener('blur', function() {
        const errorMessage = validateRange(this.value);
        this.setCustomValidity(errorMessage);
    });
}

// Hàm format số
function formatNumber(value) {
    if (typeof value === 'string' && value.startsWith('$')) {
        return value; // Giữ nguyên nếu đã có định dạng $
    }
    if (typeof value === 'number') {
        return value.toLocaleString();
    }
    return value;
}

// Cập nhật hàm xử lý response thành công
function handleTranslationSuccess(result) {
    // Ẩn progress
    const progressDiv = document.getElementById('translationProgress');
    progressDiv.classList.add('d-none');

    // Hiển thị thông tin thành công
    const successAlert = document.getElementById('successAlert');
    successAlert.classList.remove('d-none', 'alert-danger');
    successAlert.classList.add('alert-success');
    successAlert.innerHTML = `
        <h5 class="alert-heading">
            <i class="bi bi-check-circle-fill me-2"></i>
            ${window.translations.translate.result.success.title}
        </h5>
        <p class="mb-2">${window.translations.translate.result.success.stats.cells.replace('{count}', formatNumber(result.stats.totalCells))}</p>
        <p class="mb-2">${window.translations.translate.result.success.stats.chars.replace('{count}', formatNumber(result.stats.totalChars))}</p>
        <p class="mb-2">${window.translations.translate.result.success.stats.cost.replace('{amount}', formatNumber(result.stats.estimatedCost))}</p>
        <hr>
        <p class="mb-1"><strong>${window.translations.translate.result.success.stats.details.title}</strong></p>
        <ul class="list-unstyled small mb-0">
            <li>${window.translations.translate.result.success.stats.details.input_tokens.replace('{count}', formatNumber(result.stats.details.inputTokens))}</li>
            <li>${window.translations.translate.result.success.stats.details.output_tokens.replace('{count}', formatNumber(result.stats.details.outputTokens))}</li>
            <li>${window.translations.translate.result.success.stats.details.input_cost.replace('{amount}', formatNumber(result.stats.details.inputCost))}</li>
            <li>${window.translations.translate.result.success.stats.details.output_cost.replace('{amount}', formatNumber(result.stats.details.outputCost))}</li>
        </ul>
    `;

    // Scroll to success message
    successAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Reset button state với text từ translations
    const submitBtn = document.querySelector('button[type="submit"]');
    const spinner = submitBtn.querySelector('.spinner-border');
    const btnText = submitBtn.querySelector('.button-text');
    
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
    btnText.textContent = window.translations.translate.submit;
    submitBtn.classList.remove('processing');
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

// Validate API key format
document.getElementById('apiKey').addEventListener('input', function() {
    if (this.value && !this.value.match(/^sk-[a-zA-Z0-9]{32,}$/)) {
        this.setCustomValidity('API key không hợp lệ');
    } else {
        this.setCustomValidity('');
    }
});

// Update form submit to include API key from settings
document.getElementById('sheetTranslateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // ... existing validation code ...

    const formData = {
        sheetUrl: form.sheetUrl.value,
        sheetName: form.sheetName.value,
        sheetRange: form.sheetRange.value,
        targetLang: form.targetLang.value,
        domain: form.domain.value,
        apiKey: localStorage.getItem('openai_api_key') // Get API key from settings
    };

    // ... rest of the submit handler
});

// Hàm hiển thị thông báo lỗi
function showErrorAlert(error) {
    const successAlert = document.getElementById('successAlert');
    successAlert.classList.remove('d-none', 'alert-success');
    successAlert.classList.add('alert-danger');
    
    let errorMessage = window.translations.translate.result.error.unknown;
    if (error.includes('URL')) {
        errorMessage = window.translations.translate.result.error.sheet_invalid;
    } else if (error.includes('quyền') || error.includes('permission')) {
        errorMessage = window.translations.translate.result.error.permission_denied;
    } else if (error.includes('API key')) {
        errorMessage = window.translations.translate.result.error.api_error.replace('{message}', error);
    }
    
    successAlert.innerHTML = `
        <h5 class="alert-heading">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${window.translations.translate.result.error.title}
        </h5>
        <p class="mb-0">${errorMessage}</p>
    `;
} 