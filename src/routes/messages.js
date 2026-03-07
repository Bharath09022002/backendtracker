const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { handleSafetyCheck } = require('../utils/safetyFilter');

// @route   GET /api/messages/conversations
// @desc    Get all conversations for the current user
// @access  Private
router.get('/conversations', auth, async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user.id
        })
            .populate('participants', 'fullName email profilePicture')
            .populate('lastMessage')
            .sort({ updatedAt: -1 })
            .lean();

        res.json(conversations);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/messages/conversations
// @desc    Create a new conversation or group
// @access  Private
router.post('/conversations', auth, async (req, res) => {
    const { participants, type, name } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ error: 'Participants are required' });
    }

    try {
        // Resolve participant identifiers: accept both ObjectIds, shortIds, and names
        const mongoose = require('mongoose');
        const resolvedParticipants = [];
        for (const p of participants) {
            if (typeof p !== 'string') continue;
            const trimmed = p.trim();
            if (!trimmed) continue;

            if (mongoose.Types.ObjectId.isValid(trimmed) && trimmed.length === 24) {
                // It's a valid ObjectId
                const userExists = await User.findById(trimmed).select('_id');
                if (userExists) {
                    resolvedParticipants.push(trimmed);
                    continue;
                }
            }

            // Sanitize for regex if we try to search
            const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Try to find by shortId (case-insensitive) OR fullName if they typed a name
            const user = await User.findOne({
                $or: [
                    { shortId: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                    { fullName: { $regex: new RegExp(`^${escaped}$`, 'i') } }
                ]
            }).select('_id');

            if (!user) return res.status(404).json({ error: `User not found: ${trimmed}` });
            resolvedParticipants.push(user._id.toString());
        }

        // Add current user to participants if not already there
        const allParticipants = [...new Set([...resolvedParticipants, req.user.id])];

        // If it's an individual chat, check if it already exists
        if (type === 'individual' && allParticipants.length === 2) {
            let conv = await Conversation.findOne({
                type: 'individual',
                participants: { $all: allParticipants, $size: 2 }
            }).populate('participants', 'fullName email profilePicture');
            if (conv) return res.json(conv);
        }

        const newConversation = new Conversation({
            participants: allParticipants,
            type: type || 'individual',
            name: name || ""
        });

        const conversation = await newConversation.save();
        const populated = await conversation.populate('participants', 'fullName email profilePicture');
        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/messages/:conversationId
// @desc    Get message history for a conversation
// @access  Private
router.get('/:conversationId', auth, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        if (!conversation.participants.includes(req.user.id)) {
            return res.status(403).json({ error: 'Access denied: You are not a participant in this conversation' });
        }

        const messages = await Message.find({
            conversationId: req.params.conversationId
        })
            .populate('sender', 'fullName profilePicture')
            .sort({ timestamp: 1 })
            .lean();

        res.json(messages);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/messages/:conversationId
// @desc    Send a message to a conversation
// @access  Private
router.post('/:conversationId', auth, async (req, res) => {
    const { content } = req.body;

    if (!content || content.trim() === "") {
        return res.status(400).json({ error: 'Message content is required' });
    }

    try {
        const user = await User.findById(req.user.id);
        const safetyResult = await handleSafetyCheck(user, content);
        if (safetyResult.isHarmful) {
            return res.status(403).json({
                error: safetyResult.error,
                strikes: safetyResult.strikes
            });
        }

        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        if (!conversation.participants.includes(req.user.id)) {
            return res.status(403).json({ error: 'Access denied: You cannot send messages to this conversation' });
        }

        const newMessage = new Message({
            conversationId: req.params.conversationId,
            sender: req.user.id,
            content: content
        });

        const message = await newMessage.save();

        // Update conversation lastMessage and updatedAt
        conversation.lastMessage = message._id;
        conversation.updatedAt = Date.now();
        await conversation.save();

        // Emit real-time event to all participants
        const socket = require('../utils/socket');
        const populated = await Message.findById(message._id)
            .populate('sender', 'fullName profilePicture')
            .lean();
        conversation.participants.forEach(participantId => {
            const pid = participantId.toString();
            if (pid !== req.user.id) {
                socket.emitToUser(pid, 'new_message', {
                    conversationId: req.params.conversationId,
                    message: populated
                });
            }
        });

        res.json(populated);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
