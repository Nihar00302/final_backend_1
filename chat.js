const express = require('express');
const axios = require('axios');
const router = express.Router();
const mongoose = require('mongoose');
const { Chat, User } = require('./models');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Fallback responses for variety
const fallbackResponses = [
  "I understand how you're feeling. Could you tell me more about that?",
  "That's an interesting perspective. What makes you think that way?",
  "I appreciate you sharing that with me. How long have you felt this way?",
  "That sounds challenging. What would be most helpful for you right now?",
  "I'm here to listen. What's been on your mind lately?",
  "That's a valid concern. Have you tried talking to anyone else about this?",
  "I can see this is important to you. What would you like to focus on?",
  "Thank you for being open with me. How are you coping with this?",
  "That's a thoughtful question. What's your gut feeling about this?",
  "I hear you. What would be the ideal outcome for you?",
  "That's a complex situation. What's the most difficult part for you?",
  "I'm glad you reached out. What support do you feel you need most?",
  "That's a good point. How does this affect your daily life?",
  "I understand this matters to you. What's your biggest worry right now?",
  "That's worth exploring further. What triggered these thoughts?"
];

// Response variation patterns
const responsePatterns = [
  "I understand how you're feeling about {topic}. {variation}",
  "That's an interesting perspective on {topic}. {variation}",
  "I appreciate you sharing that with me. {variation}",
  "That sounds {emotion} for you. {variation}",
  "I'm here to listen and support you. {variation}",
  "That's a valid concern you're expressing. {variation}",
  "I can see this is important to you. {variation}",
  "Thank you for being open with me about {topic}. {variation}",
  "That's a thoughtful question. {variation}",
  "I hear you and I want to help. {variation}"
];

const variations = [
  "Could you tell me more about what's been happening?",
  "What makes you think that way?",
  "How long have you been feeling this way?",
  "What would be most helpful for you right now?",
  "What's been on your mind lately?",
  "Have you tried talking to anyone else about this?",
  "What would you like to focus on?",
  "How are you coping with this?",
  "What's your gut feeling about this?",
  "What would be the ideal outcome for you?",
  "What's the most difficult part for you?",
  "What support do you feel you need most?",
  "How does this affect your daily life?",
  "What's your biggest worry right now?",
  "What triggered these thoughts?"
];

function generateVariedResponse(userMessage, conversationHistory) {
  // Extract potential topics from user message
  const topics = ['anxiety', 'stress', 'depression', 'relationships', 'work', 'family', 'sleep', 'mood', 'feelings', 'thoughts'];
  const emotions = ['challenging', 'difficult', 'frustrating', 'overwhelming', 'confusing', 'worrying', 'concerning'];
  
  const detectedTopic = topics.find(topic => userMessage.toLowerCase().includes(topic)) || 'this situation';
  const detectedEmotion = emotions.find(emotion => userMessage.toLowerCase().includes(emotion)) || 'challenging';
  
  // Randomly select pattern and variation
  const pattern = responsePatterns[Math.floor(Math.random() * responsePatterns.length)];
  const variation = variations[Math.floor(Math.random() * variations.length)];
  
  // Fill in the pattern
  let response = pattern
    .replace('{topic}', detectedTopic)
    .replace('{emotion}', detectedEmotion)
    .replace('{variation}', variation);
  
  // Add some randomness to make it even more varied
  if (Math.random() < 0.3) {
    response += " I'm here to support you through this.";
  }
  
  return response;
}

router.post('/chat', async (req, res) => {
  const { message, user } = req.body;
  
  console.log('=== CHAT REQUEST START ===');
  console.log('User ID:', user);
  console.log('Message:', message);
  console.log('GROQ_API_KEY exists:', !!GROQ_API_KEY);
  console.log('GROQ_API_KEY length:', GROQ_API_KEY ? GROQ_API_KEY.length : 0);
  
  try {
    // Validate user
    if (!user) {
      console.log('❌ No user ID provided');
      return res.status(400).json({ reply: 'User ID is required.' });
    }
    
    // Ensure user exists
    const userDoc = await User.findById(user);
    if (!userDoc) {
      console.log('❌ User not found:', user);
      return res.status(404).json({ reply: 'User not found.' });
    }
    console.log('✅ User found:', userDoc.name);
    
    // Get conversation history
    let chat = await Chat.findOne({ user });
    if (!chat) {
      chat = new Chat({ user, messages: [] });
    }
    
    // Prepare conversation history for the API
    const conversationHistory = chat.messages.slice(-10); // Last 10 messages for context
    const messages = [
      { 
        role: "system", 
        content: "You are a compassionate and knowledgeable mental wellness assistant. Provide varied, empathetic, and helpful responses. Never repeat the same response twice. Always be supportive and encouraging while maintaining professional boundaries. Adapt your tone and approach based on the user's needs and the conversation context." 
      }
    ];
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });
    
    // Add current user message
    messages.push({ role: "user", content: message });
    
    console.log('📤 Sending request to Groq API...');
    console.log('Request payload:', JSON.stringify({
      model: "llama3-8b-8192",
      messages: messages.length,
      max_tokens: 300,
      temperature: 0.9
    }, null, 2));
    
    // Call Groq API with higher temperature for more variety
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama3-8b-8192",
        messages: messages,
        max_tokens: 300,
        temperature: 0.9, // Increased for more variety
        top_p: 0.9,
        frequency_penalty: 0.5, // Reduce repetition
        presence_penalty: 0.3
      },
      {
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );
    
    console.log('✅ Groq API response received');
    console.log('Response status:', response.status);
    console.log('Response data keys:', Object.keys(response.data));
    
    let botReply = response.data.choices[0].message.content;
    console.log('Bot reply from API:', botReply);
    
    // Check if response is too similar to recent responses
    const recentBotMessages = chat.messages
      .filter(msg => msg.sender === 'bot')
      .slice(-3)
      .map(msg => msg.text.toLowerCase());
    
    const currentReplyLower = botReply.toLowerCase();
    const isTooSimilar = recentBotMessages.some(recentMsg => {
      const similarity = calculateSimilarity(currentReplyLower, recentMsg);
      return similarity > 0.7; // If more than 70% similar
    });
    
    // If response is too similar, generate a varied fallback
    if (isTooSimilar || botReply.length < 10) {
      console.log('🔄 Response too similar, generating fallback...');
      botReply = generateVariedResponse(message, conversationHistory);
      console.log('Fallback reply:', botReply);
    }
    
    // Add some random variation to make responses even more unique
    if (Math.random() < 0.2) {
      const randomEndings = [
        " Take care of yourself.",
        " You're doing great by reaching out.",
        " Remember, it's okay to not be okay.",
        " I believe in your strength.",
        " You're not alone in this."
      ];
      botReply += randomEndings[Math.floor(Math.random() * randomEndings.length)];
    }
    
    // Save to database
    chat.messages.push({ sender: 'user', text: message });
    chat.messages.push({ sender: 'bot', text: botReply });
    await chat.save();
    
    console.log('✅ Chat saved to database');
    console.log('=== CHAT REQUEST END ===');
    
    res.json({ reply: botReply });
  } catch (err) {
    console.error('=== CHAT ERROR ===');
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);
    
    if (err.response) {
      console.error('Groq API error response:');
      console.error('  Status:', err.response.status);
      console.error('  Status text:', err.response.statusText);
      console.error('  Headers:', err.response.headers);
      console.error('  Data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error('Network error - no response received:');
      console.error('  Request:', err.request);
    } else {
      console.error('Other error:', err);
    }
    
    // Generate fallback response if API fails
    const fallbackReply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    console.log('Using fallback reply:', fallbackReply);
    
    if (err.response) {
      console.error("Groq API error:", err.response.status, err.response.data);
      res.status(500).json({ reply: fallbackReply });
    } else {
      console.error("Groq API error:", err.message || err);
      res.status(500).json({ reply: fallbackReply });
    }
  }
});

// Simple similarity calculation function
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}

// Endpoint to get chat history for a user
router.get('/chat/history/:userId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ user: req.params.userId }).populate('user', 'name email');
    if (!chat) return res.json({ messages: [] });
    res.json({ messages: chat.messages, user: chat.user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
});

module.exports = router; 