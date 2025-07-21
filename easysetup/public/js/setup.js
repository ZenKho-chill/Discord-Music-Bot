// Hàm hiển thị thông báo
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Xử lý submit form
document.getElementById('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const config = {
            bot: {},
            spotify: {}
        };
        
        // Chuyển đổi FormData thành object
        for (let [key, value] of formData.entries()) {
            const keys = key.split('.');
            let current = config;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
        }
        
        // Disable form trong khi đang lưu
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Đang lưu...';
        
        // Gửi cấu hình lên server
        const response = await fetch('/save-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(data.message || 'Cấu hình đã được lưu thành công!');
            
            if (data.requireRestart) {
                submitButton.textContent = 'Đã lưu - Đang khởi động lại...';
                // Đợi 2 giây rồi reload trang
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                submitButton.disabled = false;
                submitButton.textContent = 'Lưu cấu hình';
            }
        } else {
            showAlert(data.message || 'Có lỗi xảy ra khi lưu cấu hình.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Lưu cấu hình';
        }
    } catch (error) {
        console.error('Lỗi:', error);
        showAlert('Có lỗi xảy ra khi lưu cấu hình.', 'error');
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Lưu cấu hình';
    }
});
