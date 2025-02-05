(function () {
    'use strict'
    
    function initFormValidation() {
        const forms = document.querySelectorAll('.needs-validation')
        
        Array.prototype.slice.call(forms).forEach(function (form) {
            form.addEventListener('submit', function (event) {
                if (!form.checkValidity()) {
                    event.preventDefault()
                    event.stopPropagation()
                }
                form.classList.add('was-validated')
            }, false)
        })
    }

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', initFormValidation);

    // Thêm validation cho range
    const rangeInput = document.getElementById('sheetRange');
    if (rangeInput) {
        rangeInput.addEventListener('change', function(e) {
            const range = e.target.value.trim().toUpperCase();
            if (range) {
                const patterns = {
                    fullRange: /^[A-Z]+\d+:[A-Z]+\d+$/,     // C23:D34
                    columnRange: /^[A-Z]:[A-Z]$/,           // C:D hoặc D:D
                    rowRange: /^\d+:\d+$/                   // 44:46
                };

                const isValid = 
                    patterns.fullRange.test(range) ||
                    patterns.columnRange.test(range) ||
                    patterns.rowRange.test(range);

                if (!isValid) {
                    e.target.setCustomValidity('Range không đúng định dạng. Ví dụ hợp lệ: C23:D34, C:D, 44:46');
                } else {
                    e.target.setCustomValidity('');
                }
            } else {
                e.target.setCustomValidity(''); // Range là optional
            }
        });
    }
})(); 