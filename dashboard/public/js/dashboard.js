// Dashboard Interactive Features
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Music Bot Dashboard loaded successfully!');
    
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
        button.addEventListener('click', function(e) {
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
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
            this.style.transition = 'all 0.3s ease';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Add click animation
    document.querySelectorAll('.manage-btn, .discord-btn').forEach(button => {
        button.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        button.addEventListener('mouseup', function() {
            this.style.transform = '';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });





    // Notification system
    window.showNotification = function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification fade-in';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
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
        
        // Auto remove after 4 seconds
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

    // Check for errors and show notifications
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
        showNotification(urlParams.get('error'), 'error');
    }
    if (urlParams.get('success')) {
        showNotification(urlParams.get('success'), 'success');
    }
});

// Global functions for server management
window.sendCommand = function(command, guildId) {
    console.log(`Sending command: ${command} to guild: ${guildId}`);
    showNotification(`Đã gửi lệnh: ${command}`, 'success');
    
    // In real implementation, this would make an API call to the bot
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
    showNotification(`Âm lượng đã đặt: ${volume}%`, 'info');
    
    // API call would go here
};

window.playMusic = function(guildId) {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (!query) {
        showNotification('Vui lòng nhập tên bài hát hoặc URL', 'warning');
        return;
    }
    
    showNotification(`🔍 Đang tìm kiếm: ${query}`, 'info');
    searchInput.value = '';
    
    // API call would go here
    setTimeout(() => {
        showNotification(`🎵 Đã thêm vào hàng đợi: ${query}`, 'success');
    }, 2000);
};

window.clearQueue = function(guildId) {
    if (confirm('Bạn có chắc muốn xóa toàn bộ hàng đợi?')) {
        showNotification('🗑️ Đã xóa hàng đợi', 'success');
        // API call would go here
    }
};

window.saveSettings = function(guildId) {
    showNotification('💾 Đã lưu cài đặt', 'success');
    // API call would go here
};

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl + Enter to play music
    if (e.ctrlKey && e.key === 'Enter') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && document.activeElement === searchInput) {
            playMusic();
        }
    }
    
    // Escape to clear search
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && document.activeElement === searchInput) {
            searchInput.value = '';
            searchInput.blur();
        }
    }
});
