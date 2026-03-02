// ==============================================
// MACVG CHAT - Swearing Filter (Always ON)
// ==============================================

class SwearingFilter {
    constructor() {
        // Filter is ALWAYS on - no user toggle
        this.badWords = [
            // Strong swear words
            'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'whore', 'slut',
            'nigger', 'nigga', 'fag', 'faggot', 'retard', 'chink', 'spic', 'kike',
            'f u c k', 'f*ck', 'f**k', 'sh1t', '$hit', '@ss', 'b!tch', 'b1tch',
            
            // Gaming toxicity
            'noob', 'n00b', 'rekt', 'get rekt', 'uninstall', 'kys', 'kill yourself',
            'trash', 'garbage', 'feeder', 'thrower', 'reported'
        ];
        
        // Words that should be allowed even if they contain bad words
        this.allowedWords = [
            'assassin', 'classic', 'bass', 'pass', 'glass', 'grass', 'assume',
            'assignment', 'assist', 'assemble'
        ];
        
        console.log('🔤 Swearing filter initialized (ALWAYS ON)');
    }
    
    // Check if message contains bad words
    checkMessage(message, username, isAdmin = false) {
        // Admin can bypass filter
        if (isAdmin) {
            return { allowed: true, filteredMessage: message };
        }
        
        const lowerMessage = message.toLowerCase();
        let filteredMessage = message;
        let foundBadWord = false;
        
        // Check each bad word
        for (const badWord of this.badWords) {
            // Check if message contains the bad word
            if (lowerMessage.includes(badWord.toLowerCase())) {
                // Check if it's part of an allowed word
                let isAllowed = false;
                for (const allowedWord of this.allowedWords) {
                    if (lowerMessage.includes(allowedWord) && allowedWord.includes(badWord)) {
                        isAllowed = true;
                        break;
                    }
                }
                
                if (!isAllowed) {
                    foundBadWord = true;
                    // Censor the word
                    const regex = new RegExp(badWord, 'gi');
                    filteredMessage = filteredMessage.replace(regex, match => {
                        return '*'.repeat(match.length);
                    });
                }
            }
        }
        
        // Check for spaced out letters (f u c k)
        const noSpaces = message.replace(/\s+/g, '').toLowerCase();
        for (const badWord of this.badWords) {
            const noSpacesBadWord = badWord.replace(/\s+/g, '').toLowerCase();
            if (noSpaces.includes(noSpacesBadWord)) {
                foundBadWord = true;
                // Block the message entirely for spaced out words
                return {
                    allowed: false,
                    filteredMessage: '',
                    warning: 'Message blocked: Inappropriate language detected'
                };
            }
        }
        
        if (foundBadWord) {
            return {
                allowed: true,
                filteredMessage: filteredMessage,
                warning: 'Your message contained filtered words and has been censored'
            };
        }
        
        return { allowed: true, filteredMessage: message };
    }
}

// Create global filter instance
window.swearingFilter = new SwearingFilter();
