// Dashboard Interactive Features
// Khai báo biến chế độ debug toàn cục để dùng cho toàn bộ file
let cheDoDebug;
document.addEventListener('DOMContentLoaded', function () {
  // Kiểm tra chế độ debug (giá trị truyền từ server)
  cheDoDebug = window.config && window.config.debug;
  if (cheDoDebug) {
    console.log('🎵 ZK Music Bot Dashboard đã tải thành công!');
  }

  // Add smooth scrolling
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add loading states to buttons
  const buttons = document.querySelectorAll('.discord-btn, .manage-btn');
  buttons.forEach(button => {
    button.addEventListener('click', function (e) {
      if (this.href && !this.href.includes('javascript:')) {
        // Show loading state for navigation
        const originalText = this.innerHTML;
        this.innerHTML = '<i class="loading"></i> Đang tải...';
        this.style.pointerEvents = 'none';

        // Restore after delay (in case navigation fails)
        setTimeout(() => {
          this.innerHTML = originalText;
          this.style.pointerEvents = '';
        }, 5000);
      }
    });
  });

  // Add hover effects to server cards
  const serverCards = document.querySelectorAll('.server-card');
  serverCards.forEach(card => {
    card.addEventListener('mouseenter', function () {
      this.style.transform = 'translateY(-5px) scale(1.02)';
      this.style.transition = 'all 0.3s ease';
    });

    card.addEventListener('mouseleave', function () {
      this.style.transform = 'translateY(0) scale(1)';
    });
  });

  // Add click animation
  document.querySelectorAll('.manage-btn, .discord-btn').forEach(button => {
    button.addEventListener('mousedown', function () {
      this.style.transform = 'scale(0.95)';
    });

    button.addEventListener('mouseup', function () {
      this.style.transform = '';
    });

    button.addEventListener('mouseleave', function () {
      this.style.transform = '';
    });
  });




    // Hệ thống thông báo - tất cả thông báo đều đã được Việt hóa
    window.showNotification = function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification fade-in';
        notification.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            color: white;
            font-weight: bold;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        // Chọn màu nền theo loại thông báo
        switch(type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #57F287, #4ade80)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #ed4245, #dc2626)';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(135deg, #FFA500, #f59e0b)';
                break;
            case 'info':
            default:
                notification.style.background = 'linear-gradient(135deg, #5865F2, #4f46e5)';
        }
        notification.textContent = message;
        document.body.appendChild(notification);
        // Tự động ẩn sau 4 giây
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    };

  // Add slideOut animation
  const style = document.createElement('style');
  style.textContent = `
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .notification {
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
  document.head.appendChild(style);

    // Kiểm tra lỗi và hiển thị thông báo (chỉ hiển thị khi cheDoDebug bật hoặc là thông báo core)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
        if (cheDoDebug || urlParams.get('error').includes('lỗi hệ thống')) {
            showNotification(urlParams.get('error'), 'error');
        }
    }
    if (urlParams.get('success')) {
        if (cheDoDebug || urlParams.get('success').includes('thành công')) {
            showNotification(urlParams.get('success'), 'success');
        }
    }
});

// Các hàm quản lý server - đã Việt hóa và kiểm soát debug mode
window.sendCommand = function(command, guildId) {
    // Chỉ log thông tin khi cheDoDebug bật
    if (cheDoDebug) {
        console.log(`Gửi lệnh: ${command} đến máy chủ: ${guildId}`);
    }
    showNotification(`Đã gửi lệnh: ${command}`, 'success');
    // Thực tế sẽ gọi API tới bot
    // fetch(`/api/command`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ command, guildId })
    // });
};

window.setVolume = function(volume, guildId) {
    const slider = document.getElementById('volumeSlider');
    if (slider) {
        slider.value = volume;
    }
    // Thông báo không phải core, kiểm soát qua cheDoDebug
    if (cheDoDebug) {
        showNotification(`Âm lượng đã đặt: ${volume}%`, 'info');
    }
    // API call sẽ được thêm sau
};

window.playMusic = function(guildId) {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    const query = searchInput.value.trim();
    if (!query) {
        showNotification('Vui lòng nhập tên bài hát hoặc URL', 'warning');
        return;
    }
    // Thông báo tìm kiếm chỉ hiện khi cheDoDebug bật
    if (cheDoDebug) {
        showNotification(`🔍 Đang tìm kiếm: ${query}`, 'info');
    }
    searchInput.value = '';
    // API call sẽ được thêm sau
    setTimeout(() => {
        showNotification(`🎵 Đã thêm vào hàng đợi: ${query}`, 'success');
    }, 2000);
};

window.clearQueue = function(guildId) {
    if (confirm('Bạn có chắc muốn xóa toàn bộ hàng đợi?')) {
        showNotification('🗑️ Đã xóa hàng đợi', 'success');
        // API call sẽ được thêm sau
    }
};

window.saveSettings = function(guildId) {
    // Thông báo lưu cài đặt chỉ hiện khi cheDoDebug bật
    if (cheDoDebug) {
        showNotification('💾 Đã lưu cài đặt', 'success');
    }
    // API call sẽ được thêm sau
};

// Phím tắt hỗ trợ thao tác nhanh
document.addEventListener('keydown', function(e) {
    // Ctrl + Enter để phát nhạc
    if (e.ctrlKey && e.key === 'Enter') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && document.activeElement === searchInput) {
            playMusic();
        }
    }
    // Escape để xóa ô tìm kiếm
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && document.activeElement === searchInput) {
            searchInput.value = '';
            searchInput.blur();
        }
    }
});
