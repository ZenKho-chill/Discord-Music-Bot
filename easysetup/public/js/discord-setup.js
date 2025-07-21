// Lưu trữ dữ liệu form tạm thời
let formData = JSON.parse(sessionStorage.getItem('setupData') || '{}');

// Khôi phục dữ liệu đã nhập
function restoreFormData() {
    const fields = ['discordId', 'botToken', 'clientId', 'clientSecret'];
    fields.forEach(field => {
        const input = document.getElementById(field);
        if (input && formData[field]) {
            input.value = formData[field];
        }
    });
}

// Lưu dữ liệu form
function saveFormData() {
    const fields = ['discordId', 'botToken', 'clientId', 'clientSecret'];
    fields.forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            formData[field] = input.value;
        }
    });
    sessionStorage.setItem('setupData', JSON.stringify(formData));
}

// Validate form
function validateForm() {
    const fields = ['discordId', 'botToken', 'clientId', 'clientSecret'];
    let isValid = true;
    fields.forEach(field => {
        const input = document.getElementById(field);
        if (!input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }
    });
    return isValid;
}

// Chuyển đến bước tiếp theo
async function saveAndNext() {
    if (!validateForm()) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
    }

    saveFormData();
    window.location.href = '/setup/database';
}

// Khôi phục dữ liệu khi trang được tải
document.addEventListener('DOMContentLoaded', restoreFormData);

// Xử lý các link hướng dẫn
document.querySelectorAll('.help-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        // TODO: Implement help modal or redirect to documentation
        alert('Chức năng hướng dẫn đang được phát triển');
    });
});
