// ==============================================
// MACVG CHAT - Main Script
// ==============================================
// Complete chat functionality with Supabase integration
// ==============================================

class MacVGChat {
    constructor() {
        this.currentUser = null;
        this.currentUsername = null;
        this.isAdmin = false;
        this.selectedUserForGame = null;
        this.lastMessageTime = 0;
        this.typingTimeout = null;
        this.isTyping = false;
        this.onlineUsers = new Map(); // username -> lastSeen
        this.messageQueue = [];
        this.supabase = window.supabase;
        this.gameRequestChannel = null;
        this.messageChannel = null;
        
        this.init();
    }
    
    init() {
        // Check if user already has a username
        this.checkSavedUsername();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check Supabase connection
        this.checkConnection();
        
        // Set up typing indicator
        this.setupTypingIndicator();
        
        // Initialize online users list
        this.updateOnlineUsers();
        
        // Update online indicator every minute
        setInterval(() => this.updateOnlineUsers(), 60000);
        
        console.log('🎮 MacVG Chat initialized');
    }
    
    checkSavedUsername() {
        const savedUsername = localStorage.getItem('macvg_chat_username');
        if (savedUsername) {
            this.setUsername(savedUsername);
        } else {
            this.showUsernameModal();
        }
    }
    
    showUsernameModal() {
        document.getElementById('usernameModal').classList.remove('hidden');
        document.getElementById('usernameInput').focus();
    }
    
    hideUsernameModal() {
        document.getElementById('usernameModal').classList.add('hidden');
    }
    
    setUsername(username) {
        if (!username || username.trim() === '') {
            alert('Please enter a username');
            return false;
        }
        
        // Check if username is the admin
        const cleanUsername = username.trim();
        this.currentUsername = cleanUsername;
        this.isAdmin = cleanUsername.toLowerCase() === 'doneman1233';
        
        // Set display name (special for admin)
        this.currentUser = this.isAdmin ? 'Niam - Creator' : cleanUsername;
        
        // Save to localStorage
        localStorage.setItem('macvg_chat_username', cleanUsername);
        
        // Update UI
        this.hideUsernameModal();
        this.connectToChat();
        
        // Request notification permission after user joins
        setTimeout(() => {
            if (window.notificationManager && 
                window.notificationManager.permission === 'default') {
                // We'll request permission when first message is sent
                console.log('Notification permission will be requested on first message');
            }
        }, 1000);
        
        return true;
    }
    
    async connectToChat() {
        if (!window.isSupabaseConfigured()) {
            this.showError('Supabase is not configured. Please check your credentials.');
            return;
        }
        
        // Subscribe to chat messages
        this.subscribeToMessages();
        
        // Subscribe to game requests
        this.subscribeToGameRequests();
        
        // Load recent messages
        await this.loadRecentMessages();
        
        // Update online status
        this.updateUserOnlineStatus();
        
        console.log(`👤 Connected as: ${this.currentUser} ${this.isAdmin ? '(Admin)' : ''}`);
    }
    
    async checkConnection() {
        const isConnected = await window.testSupabaseConnection();
        if (!isConnected) {
            this.showError('Cannot connect to chat server. Using offline mode.');
        }
        return isConnected;
    }
    
    setupEventListeners() {
        // Username modal
        document.getElementById('joinChatBtn').addEventListener('click', () => {
            const username = document.getElementById('usernameInput').value;
            this.setUsername(username);
        });
        
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const username = document.getElementById('usernameInput').value;
                this.setUsername(username);
            }
        });
        
        // Message input
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Typing detection
        messageInput.addEventListener('input', () => {
            this.handleTyping();
            this.updateCharCount();
        });
        
        // Game request button
        document.getElementById('gameRequestBtn').addEventListener('click', () => {
            if (this.selectedUserForGame) {
                this.showGameRequestPrompt();
            }
        });
        
        // Game request modal buttons
        document.getElementById('acceptRequestBtn').addEventListener('click', () => {
            this.handleGameRequestResponse(true);
        });
        
        document.getElementById('declineRequestBtn').addEventListener('click', () => {
            this.handleGameRequestResponse(false);
        });
        
        document.getElementById('closeSentModalBtn').addEventListener('click', () => {
            document.getElementById('requestSentModal').classList.add('hidden');
        });
        
        // Notifications button
        document.getElementById('notificationsBtn').addEventListener('click', () => {
            this.toggleNotifications();
        });
        
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.toggleUsersOnline();
        });
        
        // Close users online sidebar
        document.getElementById('closeUsersBtn').addEventListener('click', () => {
            this.toggleUsersOnline();
        });
        
        // Emoji button
        document.getElementById('emojiBtn').addEventListener('click', () => {
            this.showEmojiPicker();
        });
        
        // Character count
        this.updateCharCount();
    }
    
    setupTypingIndicator() {
        // This will be updated by realtime typing events
    }
    
    async subscribeToMessages() {
        if (!this.supabase) return;
        
        try {
            this.messageChannel = this.supabase
                .channel('chat_messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_messages'
                    },
                    (payload) => {
                        this.displayMessage(payload.new);
                        this.notifyNewMessage(payload.new);
                    }
                )
                .subscribe();
            
            console.log('✅ Subscribed to chat messages');
            
        } catch (error) {
            console.error('❌ Error subscribing to messages:', error);
        }
    }
    
    async subscribeToGameRequests() {
        if (!this.supabase) return;
        
        try {
            this.gameRequestChannel = this.supabase
                .channel('game_requests')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'game_requests',
                        filter: `to_user=eq.${this.currentUsername}`
                    },
                    (payload) => {
                        if (payload.new.status === 'pending') {
                            this.handleIncomingGameRequest(payload.new);
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'game_requests',
                        filter: `from_user=eq.${this.currentUsername}`
                    },
                    (payload) => {
                        this.handleGameRequestUpdate(payload.new);
                    }
                )
                .subscribe();
            
            console.log('✅ Subscribed to game requests');
            
        } catch (error) {
            console.error('❌ Error subscribing to game requests:', error);
        }
    }
    
    async loadRecentMessages(limit = 50) {
        if (!this.supabase) return;
        
        try {
            const { data, error } = await this.supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            
            // Clear welcome message
            const messagesContainer = document.getElementById('messagesContainer');
            const welcomeMessage = messagesContainer.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.style.display = 'none';
            }
            
            // Display messages in chronological order
            data.reverse().forEach(message => {
                this.displayMessage(message, false);
            });
            
            // Scroll to bottom
            this.scrollToBottom();
            
        } catch (error) {
            console.error('❌ Error loading messages:', error);
        }
    }
    
    displayMessage(messageData, animate = true) {
        const messagesContainer = document.getElementById('messagesContainer');
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${messageData.is_admin ? 'admin' : ''}`;
        
        if (animate) {
            messageDiv.style.animation = 'fadeInUp 0.4s ease';
        }
        
        // Format time
        const messageTime = new Date(messageData.created_at);
        const timeString = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Create message HTML
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-username" data-username="${messageData.user_id}">
                    ${messageData.display_name}
                </span>
                ${messageData.is_admin ? '<span class="admin-badge">ADMIN</span>' : ''}
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">
                ${this.escapeHtml(messageData.message)}
                ${!messageData.is_admin ? `
                    <button class="request-game-btn" data-username="${messageData.user_id}" data-display-name="${messageData.display_name}">
                        <i class="fas fa-gamepad"></i> Request to Play
                    </button>
                ` : ''}
            </div>
        `;
        
        // Add to container
        messagesContainer.appendChild(messageDiv);
        
        // Add click listener to username
        const usernameSpan = messageDiv.querySelector('.message-username');
        usernameSpan.addEventListener('click', (e) => {
            const username = e.target.dataset.username;
            this.selectUserForGame(username, messageData.display_name);
        });
        
        // Add click listener to request button
        const requestBtn = messageDiv.querySelector('.request-game-btn');
        if (requestBtn) {
            requestBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = e.target.closest('button').dataset.username;
                const displayName = e.target.closest('button').dataset.displayName;
                this.selectUserForGame(username, displayName);
                this.showGameRequestPrompt();
            });
        }
        
        // Scroll to bottom if user is near bottom
        this.scrollToBottom();
        
        // Update online users
        this.updateUserLastSeen(messageData.user_id);
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        // Request notification permission on first message
        if (this.lastMessageTime === 0 && window.notificationManager) {
            if (window.notificationManager.permission === 'default') {
                await window.notificationManager.requestPermission();
            }
        }
        
        // Clear input
        messageInput.value = '';
        this.updateCharCount();
        
        // Send to Supabase
        if (this.supabase) {
            try {
                const messageData = {
                    user_id: this.currentUsername,
                    display_name: this.currentUser,
                    is_admin: this.isAdmin,
                    message: message,
                    created_at: new Date().toISOString()
                };
                
                const { error } = await this.supabase
                    .from('chat_messages')
                    .insert([messageData]);
                
                if (error) throw error;
                
                // Update last message time
                this.lastMessageTime = Date.now();
                
                // Update typing status
                this.stopTyping();
                
                // Update online status
                this.updateUserOnlineStatus();
                
            } catch (error) {
                console.error('❌ Error sending message:', error);
                // Store in queue for retry
                this.messageQueue.push({ message, timestamp: Date.now() });
                this.showError('Failed to send message. Will retry...');
            }
        }
    }
    
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            // In a real app, you would broadcast typing status via Supabase
        }
        
        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Set timeout to stop typing indicator
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.stopTyping();
        }, 2000);
    }
    
    stopTyping() {
        // In a real app, you would broadcast stop typing via Supabase
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
    }
    
    updateCharCount() {
        const messageInput = document.getElementById('messageInput');
        const charCount = document.getElementById('charCount');
        const count = messageInput.value.length;
        
        charCount.textContent = `${count}/500`;
        
        // Change color if接近 limit
        if (count > 450) {
            charCount.style.color = '#ff4444';
        } else if (count > 400) {
            charCount.style.color = '#ffaa00';
        } else {
            charCount.style.color = '#777';
        }
    }
    
    selectUserForGame(username, displayName) {
        this.selectedUserForGame = {
            username: username,
            displayName: displayName
        };
        
        // Enable game request button
        const gameRequestBtn = document.getElementById('gameRequestBtn');
        gameRequestBtn.disabled = false;
        gameRequestBtn.title = `Request ${displayName} to play a game`;
        
        console.log(`🎯 Selected user for game: ${displayName}`);
    }
    
    showGameRequestPrompt() {
        if (!this.selectedUserForGame) return;
        
        // Create a simple prompt (we'll enhance this later)
        const gameName = prompt(`Enter the game name you want to play with ${this.selectedUserForGame.displayName}:`);
        
        if (gameName && gameName.trim() !== '') {
            this.sendGameRequest(gameName.trim());
        }
    }
    
    async sendGameRequest(gameName) {
        if (!this.selectedUserForGame || !this.supabase) return;
        
        try {
            const requestData = {
                from_user: this.currentUsername,
                from_display_name: this.currentUser,
                to_user: this.selectedUserForGame.username,
                game_name: gameName,
                status: 'pending',
                created_at: new Date().toISOString()
            };
            
            const { error } = await this.supabase
                .from('game_requests')
                .insert([requestData]);
            
            if (error) throw error;
            
            // Show success message
            this.showRequestSentModal(this.selectedUserForGame.displayName, gameName);
            
            // Notify other tabs
            if (window.notificationManager) {
                window.notificationManager.notifyOtherTab('game_request', requestData);
            }
            
            console.log(`🎮 Game request sent: ${gameName} to ${this.selectedUserForGame.displayName}`);
            
        } catch (error) {
            console.error('❌ Error sending game request:', error);
            alert('Failed to send game request. Please try again.');
        }
    }
    
    handleIncomingGameRequest(requestData) {
        console.log('🎮 Incoming game request:', requestData);
        
        // Show game request modal
        const modal = document.getElementById('gameRequestModal');
        const message = document.getElementById('requestMessage');
        const gameNameDisplay = document.getElementById('gameNameDisplay');
        
        message.textContent = `${requestData.from_display_name} wants to play a game with you!`;
        gameNameDisplay.textContent = requestData.game_name;
        
        // Store request ID for later
        modal.dataset.requestId = requestData.id;
        modal.dataset.fromUser = requestData.from_user;
        modal.dataset.gameName = requestData.game_name;
        
        modal.classList.remove('hidden');
        
        // Notify other tabs
        if (window.notificationManager) {
            window.notificationManager.notifyOtherTab('game_request', requestData);
        }
        
        // Play sound
        window.notificationManager.playNotificationSound();
    }
    
    async handleGameRequestResponse(accepted) {
        const modal = document.getElementById('gameRequestModal');
        const requestId = modal.dataset.requestId;
        const fromUser = modal.dataset.fromUser;
        const gameName = modal.dataset.gameName;
        
        if (!requestId || !this.supabase) return;
        
        try {
            const updateData = {
                status: accepted ? 'accepted' : 'rejected',
                responded_at: new Date().toISOString()
            };
            
            const { error } = await this.supabase
                .from('game_requests')
                .update(updateData)
                .eq('id', requestId);
            
            if (error) throw error;
            
            // Hide modal
            modal.classList.add('hidden');
            
            // Show appropriate message
            if (accepted) {
                this.showRequestSentModal(
                    `You accepted ${fromUser}'s request to play ${gameName}!`,
                    true
                );
                
                // Search for the game (in real implementation, this would redirect)
                console.log(`🔍 Searching for game: ${gameName}`);
                
                // Notify requester
                this.sendSystemMessage(
                    `${this.currentUser} accepted your request to play ${gameName}!`
                );
                
                // Notify other tabs
                if (window.notificationManager) {
                    window.notificationManager.notifyOtherTab('request_accepted', {
                        gameName: gameName,
                        fromUser: this.currentUser
                    });
                }
            } else {
                this.showRequestSentModal(
                    `You declined ${fromUser}'s game request.`,
                    false
                );
                
                // Notify requester
                this.sendSystemMessage(
                    `${this.currentUser} declined your game request.`
                );
                
                // Notify other tabs
                if (window.notificationManager) {
                    window.notificationManager.notifyOtherTab('request_rejected', {
                        fromUser: this.currentUser
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error updating game request:', error);
            alert('Failed to process request. Please try again.');
        }
    }
    
    handleGameRequestUpdate(requestData) {
        // This handles updates to requests we sent (accepted/rejected)
        if (requestData.status === 'accepted') {
            this.showRequestSentModal(
                `${requestData.to_user} accepted your request to play ${requestData.game_name}!`,
                true
            );
            
            // Notify other tabs
            if (window.notificationManager) {
                window.notificationManager.showRequestAcceptedNotification(
                    requestData.game_name,
                    requestData.to_user
                );
            }
        } else if (requestData.status === 'rejected') {
            this.showRequestSentModal(
                `${requestData.to_user} declined your game request.`,
                false
            );
            
            // Notify other tabs
            if (window.notificationManager) {
                window.notificationManager.showRequestRejectedNotification(
                    requestData.to_user
                );
            }
        }
    }
    
    showRequestSentModal(message, isSuccess = true) {
        const modal = document.getElementById('requestSentModal');
        const sentMessage = document.getElementById('sentMessage');
        const icon = modal.querySelector('.sent-icon i');
        
        sentMessage.textContent = message;
        
        if (isSuccess) {
            icon.className = 'fas fa-check-circle';
            icon.style.color = '#00ff88';
        } else {
            icon.className = 'fas fa-times-circle';
            icon.style.color = '#ff4444';
        }
        
        modal.classList.remove('hidden');
    }
    
    async sendSystemMessage(message) {
        if (!this.supabase) return;
        
        try {
            const messageData = {
                user_id: 'system',
                display_name: 'System',
                is_admin: false,
                message: message,
                created_at: new Date().toISOString()
            };
            
            const { error } = await this.supabase
                .from('chat_messages')
                .insert([messageData]);
            
            if (error) throw error;
            
        } catch (error) {
            console.error('❌ Error sending system message:', error);
        }
    }
    
    notifyNewMessage(messageData) {
        // Notify other tabs
        if (window.notificationManager) {
            window.notificationManager.notifyOtherTab('new_message', {
                message: `${messageData.display_name}: ${messageData.message}`
            });
        }
    }
    
    updateUserOnlineStatus() {
        // In a real app, you would update a dedicated online_users table
        // For now, we'll just update the UI based on recent messages
        this.updateOnlineUsers();
    }
    
    updateUserLastSeen(username) {
        this.onlineUsers.set(username, Date.now());
        this.updateOnlineUsers();
    }
    
    updateOnlineUsers() {
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        
        // Remove users last seen more than 5 minutes ago
        for (const [username, lastSeen] of this.onlineUsers.entries()) {
            if (lastSeen < fiveMinutesAgo) {
                this.onlineUsers.delete(username);
            }
        }
        
        // Add current user
        if (this.currentUsername) {
            this.onlineUsers.set(this.currentUsername, now);
        }
        
        // Update UI
        const onlineCount = this.onlineUsers.size;
        document.getElementById('onlineCount').textContent = onlineCount;
        document.getElementById('totalUsers').textContent = onlineCount;
        
        // Update users list
        this.updateUsersList();
    }
    
    updateUsersList() {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        // Clear existing users (except admin)
        const adminUser = usersList.querySelector('.admin-user');
        usersList.innerHTML = '';
        if (adminUser) {
            usersList.appendChild(adminUser);
        }
        
        // Add current users
        this.onlineUsers.forEach((lastSeen, username) => {
            if (username.toLowerCase() === 'doneman1233') return; // Skip admin (already shown)
            
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <span class="user-badge"><i class="fas fa-user"></i></span>
                <span class="username">${username}</span>
                <span class="user-status active"></span>
            `;
            
            userItem.addEventListener('click', () => {
                this.selectUserForGame(username, username);
            });
            
            usersList.appendChild(userItem);
        });
    }
    
    toggleUsersOnline() {
        const usersOnline = document.getElementById('usersOnline');
        usersOnline.classList.toggle('open');
    }
    
    toggleNotifications() {
        if (window.toggleNotifications) {
            const enabled = window.toggleNotifications();
            const btn = document.getElementById('notificationsBtn');
            const icon = btn.querySelector('i');
            
            if (enabled) {
                icon.className = 'fas fa-bell';
                btn.title = 'Notifications enabled - Click to disable';
            } else {
                icon.className = 'fas fa-bell-slash';
                btn.title = 'Notifications disabled - Click to enable';
            }
        }
    }
    
    showEmojiPicker() {
        // Simple emoji picker
        const emojis = ['😀', '😂', '🥳', '🎮', '👾', '🕹️', '🎯', '🏆', '🔥', '⭐', '❤️', '👍', '👋', '🎉', '✨'];
        const messageInput = document.getElementById('messageInput');
        
        // Create emoji picker
        const picker = document.createElement('div');
        picker.className = 'emoji-picker';
        picker.style.cssText = `
            position: absolute;
            bottom: 60px;
            right: 20px;
            background: #1a1a1a;
            border: 2px solid #ff7a00;
            border-radius: 10px;
            padding: 10px;
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
            z-index: 10000;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        `;
        
        // Add emojis
        emojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.textContent = emoji;
            btn.style.cssText = `
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                padding: 5px;
                border-radius: 5px;
                transition: background 0.2s;
            `;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255,122,0,0.2)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'none';
            });
            btn.addEventListener('click', () => {
                messageInput.value += emoji;
                messageInput.focus();
                picker.remove();
            });
            picker.appendChild(btn);
        });
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.style.cssText = `
            grid-column: 1 / -1;
            margin-top: 5px;
            background: rgba(255,122,0,0.2);
            color: #ff7a00;
            border: none;
            border-radius: 5px;
            padding: 5px;
            cursor: pointer;
        `;
        closeBtn.addEventListener('click', () => picker.remove());
        picker.appendChild(closeBtn);
        
        // Remove existing picker if any
        const existingPicker = document.querySelector('.emoji-picker');
        if (existingPicker) existingPicker.remove();
        
        // Add to DOM
        document.getElementById('chatContainer').appendChild(picker);
        
        // Close on outside click
        setTimeout(() => {
            const closeOnClick = (e) => {
                if (!picker.contains(e.target) && e.target.id !== 'emojiBtn') {
                    picker.remove();
                    document.removeEventListener('click', closeOnClick);
                }
            };
            document.addEventListener('click', closeOnClick);
        }, 100);
    }
    
    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showError(message) {
        console.error('❌', message);
        // You could add a more sophisticated error display here
    }
}

// Global function for notification click handling
window.handleNotificationClick = function(requestData) {
    // This is called when a notification is clicked
    if (window.macvgChat) {
        window.macvgChat.handleIncomingGameRequest(requestData);
    }
};

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.macvgChat = new MacVGChat();
    
    // Add some CSS for additional styles
    const additionalStyles = document.createElement('style');
    additionalStyles.textContent = `
        .admin .message-content {
            animation: glow 2s infinite alternate !important;
        }
        
        .message.game-request {
            border-left: 3px solid #ff7a00;
            background: rgba(255, 122, 0, 0.05);
            padding: 10px;
            margin: 10px 0;
            border-radius: 8px;
        }
        
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
        }
    `;
    document.head.appendChild(additionalStyles);
});

// ==============================================
// CHAT IS NOW READY!
// ==============================================
// Remember to:
// 1. Update supabase-config.js with your credentials
// 2. Make sure your Supabase tables are set up correctly
// 3. Test the chat in your sidebar
// ==============================================
