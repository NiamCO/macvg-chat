// ==============================================
// MACVG CHAT - Notifications System
// ==============================================
// Handles browser notifications for new messages and game requests
// ==============================================

class NotificationManager {
    constructor() {
        this.permission = null;
        this.notificationsEnabled = false;
        this.isWindowFocused = true;
        this.lastNotificationTime = 0;
        this.cooldownPeriod = 3000; // 3 seconds between notifications
        this.pendingRequests = new Set(); // Track game requests to avoid duplicates
        
        this.init();
    }
    
    init() {
        // Check current permission
        if ('Notification' in window) {
            this.permission = Notification.permission;
            
            // If permission wasn't granted or denied yet, we'll ask later
            if (this.permission === 'default') {
                console.log('ℹ️ Notification permission not yet requested');
            } else if (this.permission === 'granted') {
                this.notificationsEnabled = true;
                console.log('✅ Notifications are enabled');
            }
        } else {
            console.warn('⚠️ This browser does not support notifications');
        }
        
        // Track window focus
        window.addEventListener('focus', () => {
            this.isWindowFocused = true;
            // Clear notification badge when user comes back
            this.updateNotificationBadge(false);
        });
        
        window.addEventListener('blur', () => {
            this.isWindowFocused = false;
        });
        
        // Listen for chat messages from other tabs
        this.setupBroadcastChannel();
    }
    
    setupBroadcastChannel() {
        // Use BroadcastChannel to communicate between tabs
        if ('BroadcastChannel' in window) {
            try {
                this.broadcastChannel = new BroadcastChannel('macvg_chat');
                
                this.broadcastChannel.onmessage = (event) => {
                    const data = event.data;
                    
                    switch (data.type) {
                        case 'new_message':
                            if (!this.isWindowFocused) {
                                this.showMessageNotification(data.message);
                            }
                            break;
                            
                        case 'game_request':
                            if (!this.isWindowFocused) {
                                this.showGameRequestNotification(data.request);
                            }
                            break;
                            
                        case 'request_accepted':
                            this.showRequestAcceptedNotification(data.gameName, data.fromUser);
                            break;
                            
                        case 'request_rejected':
                            this.showRequestRejectedNotification(data.fromUser);
                            break;
                    }
                };
                
                console.log('✅ BroadcastChannel initialized for cross-tab communication');
            } catch (error) {
                console.warn('⚠️ Could not create BroadcastChannel:', error);
            }
        }
    }
    
    // Request notification permission from user
    async requestPermission() {
        if (!('Notification' in window)) {
            return false;
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            this.notificationsEnabled = permission === 'granted';
            
            if (this.notificationsEnabled) {
                console.log('✅ Notification permission granted');
                this.showWelcomeNotification();
                return true;
            } else {
                console.log('❌ Notification permission denied');
                return false;
            }
        } catch (error) {
            console.error('❌ Error requesting notification permission:', error);
            return false;
        }
    }
    
    // Show welcome notification when permissions are granted
    showWelcomeNotification() {
        if (!this.notificationsEnabled) return;
        
        this.showNotification({
            title: 'MacVG Chat Notifications Enabled!',
            body: 'You will now receive notifications for new messages and game requests.',
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616918.png',
            tag: 'welcome'
        });
    }
    
    // Show notification for new message
    showMessageNotification(message) {
        if (!this.shouldShowNotification()) return;
        
        const now = Date.now();
        if (now - this.lastNotificationTime < this.cooldownPeriod) return;
        
        this.lastNotificationTime = now;
        
        // Truncate long messages
        const truncatedMessage = message.length > 60 
            ? message.substring(0, 57) + '...' 
            : message;
        
        this.showNotification({
            title: 'New Message in MacVG Chat',
            body: `${truncatedMessage}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616918.png',
            tag: 'new_message'
        });
    }
    
    // Show notification for game request
    showGameRequestNotification(requestData) {
        if (!this.shouldShowNotification()) return;
        
        // Create unique ID for this request to avoid duplicates
        const requestId = `${requestData.fromUser}_${requestData.gameName}_${Date.now()}`;
        
        if (this.pendingRequests.has(requestId)) {
            return; // Already showed notification for this request
        }
        
        this.pendingRequests.add(requestId);
        
        // Clean up old requests after 30 seconds
        setTimeout(() => {
            this.pendingRequests.delete(requestId);
        }, 30000);
        
        this.showNotification({
            title: '🎮 Game Request!',
            body: `${requestData.fromDisplayName} wants to play ${requestData.gameName}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616918.png',
            tag: 'game_request',
            data: requestData
        });
    }
    
    // Show notification when someone accepts your game request
    showRequestAcceptedNotification(gameName, fromUser) {
        if (!this.shouldShowNotification()) return;
        
        this.showNotification({
            title: '✅ Game Request Accepted!',
            body: `${fromUser} accepted your request to play ${gameName}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616918.png',
            tag: 'request_accepted'
        });
    }
    
    // Show notification when someone rejects your game request
    showRequestRejectedNotification(fromUser) {
        if (!this.shouldShowNotification()) return;
        
        this.showNotification({
            title: '❌ Game Request Declined',
            body: `${fromUser} declined your game request`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616918.png',
            tag: 'request_rejected'
        });
    }
    
    // Show a notification to another tab
    notifyOtherTab(eventType, data) {
        if (this.broadcastChannel && !this.isWindowFocused) {
            this.broadcastChannel.postMessage({
                type: eventType,
                ...data
            });
        }
    }
    
    // Internal method to show notification
    showNotification(options) {
        if (!this.notificationsEnabled || !this.permission === 'granted') return;
        
        try {
            const notification = new Notification(options.title, {
                body: options.body,
                icon: options.icon || 'https://cdn-icons-png.flaticon.com/512/3616/3616918.png',
                tag: options.tag,
                data: options.data,
                requireInteraction: options.requireInteraction || false,
                silent: false
            });
            
            // Handle notification click
            notification.onclick = () => {
                window.focus();
                notification.close();
                
                // If it's a game request notification, trigger the request modal
                if (options.tag === 'game_request' && options.data) {
                    // This will be handled by the main chat script
                    if (window.handleNotificationClick) {
                        window.handleNotificationClick(options.data);
                    }
                }
            };
            
            // Auto-close after 8 seconds unless it requires interaction
            if (!options.requireInteraction) {
                setTimeout(() => {
                    notification.close();
                }, 8000);
            }
            
            return notification;
            
        } catch (error) {
            console.error('❌ Error showing notification:', error);
        }
    }
    
    // Check if we should show a notification
    shouldShowNotification() {
        return this.notificationsEnabled && 
               this.permission === 'granted' && 
               !this.isWindowFocused;
    }
    
    // Update the notification badge in the UI
    updateNotificationBadge(hasUnread) {
        const notificationsBtn = document.getElementById('notificationsBtn');
        if (!notificationsBtn) return;
        
        if (hasUnread) {
            notificationsBtn.classList.add('has-notifications');
            
            // Add badge if not already there
            if (!notificationsBtn.querySelector('.notification-badge')) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                badge.textContent = '!';
                notificationsBtn.appendChild(badge);
                
                // Add CSS for badge
                if (!document.getElementById('notification-badge-style')) {
                    const style = document.createElement('style');
                    style.id = 'notification-badge-style';
                    style.textContent = `
                        .notification-badge {
                            position: absolute;
                            top: -5px;
                            right: -5px;
                            background: #ff4444;
                            color: white;
                            border-radius: 50%;
                            width: 18px;
                            height: 18px;
                            font-size: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: bold;
                            animation: pulse 1.5s infinite;
                        }
                        
                        .icon-btn {
                            position: relative;
                        }
                        
                        .has-notifications {
                            animation: shake 0.5s ease;
                        }
                        
                        @keyframes shake {
                            0%, 100% { transform: rotate(0); }
                            25% { transform: rotate(-10deg); }
                            75% { transform: rotate(10deg); }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
        } else {
            notificationsBtn.classList.remove('has-notifications');
            const badge = notificationsBtn.querySelector('.notification-badge');
            if (badge) {
                badge.remove();
            }
        }
    }
    
    // Toggle notifications on/off
    toggleNotifications() {
        if (this.notificationsEnabled) {
            this.notificationsEnabled = false;
            console.log('🔕 Notifications disabled');
            return false;
        } else {
            if (this.permission === 'granted') {
                this.notificationsEnabled = true;
                console.log('🔔 Notifications enabled');
                return true;
            } else if (this.permission === 'default') {
                // Request permission
                return this.requestPermission();
            }
            return false;
        }
    }
    
    // Get current notification status
    getStatus() {
        return {
            supported: 'Notification' in window,
            permission: this.permission,
            enabled: this.notificationsEnabled,
            windowFocused: this.isWindowFocused
        };
    }
    
    // Play a subtle sound for notifications (fallback)
    playNotificationSound() {
        try {
            // Create a simple beep sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            
        } catch (error) {
            console.log('ℹ️ Could not play notification sound');
        }
    }
}

// Create global notification manager instance
window.notificationManager = new NotificationManager();

// Export for use in other files
window.requestNotificationPermission = () => window.notificationManager.requestPermission();
window.toggleNotifications = () => window.notificationManager.toggleNotifications();
window.getNotificationStatus = () => window.notificationManager.getStatus();

// Request permission when user interacts with the page
document.addEventListener('DOMContentLoaded', () => {
    // We'll request permission when user tries to join chat
    // This is better for user experience than asking immediately
    console.log('🔔 Notification system ready - will request permission when needed');
});

// ==============================================
// USAGE EXAMPLES:
// ==============================================
// 1. Check if notifications are supported:
//    if (window.notificationManager.getStatus().supported) { ... }
//
// 2. Request permission:
//    window.notificationManager.requestPermission()
//
// 3. Show a new message notification:
//    window.notificationManager.showMessageNotification("Hello world!");
//
// 4. Notify other tabs about new message:
//    window.notificationManager.notifyOtherTab('new_message', {message: "Hello"});
// ==============================================
