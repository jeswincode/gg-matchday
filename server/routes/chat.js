import express from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import User from '../models/User.js';
import ChatMessage from '../models/ChatMessage.js';
import { chatMonth, messageText } from '../services/validation.js';

const router = express.Router();
const clients = new Map();
const lifetime = 5 * 24 * 60 * 60 * 1000;
const monthlyLimit = 3;

router.use(requireAuth);
router.use((req, res, next) =>
  process.env.CHAT_ENABLED === 'true'
    ? next()
    : res.status(503).json({ message: 'Community chat is not enabled on this server yet.' })
);

function usageFor(user, month) {
  const used = user.chatMonth === month ? Math.max(0, Number(user.chatMessagesUsed) || 0) : 0;
  return { used, remaining: Math.max(0, monthlyLimit - used) };
}

function broadcast(message) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const [clientId, client] of clients) {
    try {
      client.res.write(payload);
    } catch (error) {
      console.warn('Removing closed chat connection:', error.message);
      clients.delete(clientId);
      try { client.res.end(); } catch { /* Connection is already closed. */ }
    }
  }
}

function serializeMessage(message) {
  return {
    id: String(message._id || message.id),
    name: message.name,
    photo: message.photo || '',
    text: message.text,
    createdAt: new Date(message.createdAt).getTime(),
    expiresAt: new Date(message.expiresAt).getTime(),
  };
}

router.get('/', async (req, res) => {
  try {
    const monthKey = chatMonth();
    const usage = usageFor(req.user, monthKey);
    const history = await ChatMessage.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.json({
      used: usage.used >= monthlyLimit,
      messagesUsed: usage.used,
      messagesRemaining: usage.remaining,
      monthlyLimit,
      monthKey,
      expiresSeconds: lifetime / 1000,
      messages: history.map(serializeMessage),
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ message: 'Could not load chat history.' });
  }
});

router.get('/stream', async (req, res) => {
  const key = String(req.user._id);
  if ([...clients.values()].filter((client) => client.user === key).length >= 3 || clients.size >= 500) {
    return res.status(429).json({ message: 'Too many open chat connections.' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const clientId = randomUUID();
  clients.set(clientId, { user: key, res });

  try {
    const history = await ChatMessage.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    for (const message of history) {
      try {
        res.write(`data: ${JSON.stringify(serializeMessage(message))}\n\n`);
      } catch {
        clients.delete(clientId);
        return;
      }
    }
  } catch (error) {
    console.error('Chat stream history error:', error);
    clients.delete(clientId);
    try { res.end(); } catch { /* Connection is already closed. */ }
    return;
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      clients.delete(clientId);
      try { res.end(); } catch { /* Connection is already closed. */ }
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});

router.post('/', async (req, res) => {
  try {
    const text = messageText(req.body.message);
    const month = chatMonth();

    await User.updateOne(
      { _id: req.user._id, chatMonth: { $ne: month } },
      { $set: { chatMonth: month, chatMessagesUsed: 0 } }
    );

    const claimed = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        chatMonth: month,
        chatMessagesUsed: { $lt: monthlyLimit },
      },
      { $inc: { chatMessagesUsed: 1 } },
      { new: true }
    );

    if (!claimed) {
      return res.status(409).json({
        message: 'You have used all 3 messages for this calendar month.',
      });
    }

    const now = new Date();
    const created = await ChatMessage.create({
      name: req.user.name,
      photo: req.user.profileImage || '',
      text,
      createdAt: now,
      expiresAt: new Date(now.getTime() + lifetime),
    });

    const message = serializeMessage(created);
    const usage = usageFor(claimed, month);
    broadcast(message);

    res.status(201).json({
      message,
      used: usage.used >= monthlyLimit,
      messagesUsed: usage.used,
      messagesRemaining: usage.remaining,
      monthlyLimit,
      monthKey: month,
      expiresSeconds: lifetime / 1000,
    });
  } catch (e) {
    console.error('Chat send error:', e);
    res.status(400).json({
      message: e.message === 'Write a message between 1 and 500 characters.'
        ? e.message
        : 'Could not send your message.',
    });
  }
});

export default router;
