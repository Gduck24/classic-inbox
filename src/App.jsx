import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Menu,
  Search,
  Pin,
  Clock,
  Check,
  CheckCheck,
  Inbox as InboxIcon,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  KeyRound,
  X,
  Mail,
  Sparkles,
  ShoppingBag,
  Landmark,
  Bell,
  Users,
  Plane,
  ArrowLeft,
  Send,
  RotateCcw,
  Reply,
  Forward,
  RefreshCw,
  GripVertical,
  Moon,
  Sun,
  AlignJustify,
  StickyNote,
  FolderPlus,
  BellRing,
} from 'lucide-react';

const ICON_MAP = {
  Mail,
  Bell,
  Landmark,
  ShoppingBag,
  Sparkles,
  Users,
  Plane,
  BellRing,
};

const DEFAULT_BUNDLES = [
  { id: 'Primary', label: 'Primary', color: '#4285F4', iconName: 'Mail', inlineBundle: false, custom: false },
  { id: 'Updates', label: 'Updates', color: '#FBBC05', iconName: 'Bell', inlineBundle: true, custom: false },
  { id: 'Finance', label: 'Finance', color: '#0F9D58', iconName: 'Landmark', inlineBundle: true, custom: false },
  { id: 'Purchases', label: 'Purchases', color: '#8E24AA', iconName: 'ShoppingBag', inlineBundle: true, custom: false },
  { id: 'Promos', label: 'Promos', color: '#00ACC1', iconName: 'Sparkles', inlineBundle: true, custom: false },
  { id: 'Social', label: 'Social', color: '#DB4437', iconName: 'Users', inlineBundle: true, custom: false },
  { id: 'Travel', label: 'Travel', color: '#3F51B5', iconName: 'Plane', inlineBundle: true, custom: false },
];

const DEFAULT_RULES = [
  { id: 'r1', name: 'Kickstarter -> Updates', field: 'sender', pattern: 'kickstarter', bundle: 'Updates' },
  { id: 'r2', name: 'ATF eForms -> Updates', field: 'sender', pattern: 'eforms.notifications', bundle: 'Updates' },
  { id: 'r3', name: 'Invoices & Statements -> Finance', field: 'any', pattern: 'invoice|balance due|statement|payment request', bundle: 'Finance' },
  { id: 'r4', name: 'Receipts & Orders -> Purchases', field: 'any', pattern: 'receipt|order confirmation|rma|shipped', bundle: 'Purchases' },
  { id: 'r5', name: 'Deals & Promos -> Promos', field: 'any', pattern: '% off|black friday|sale|unsubscribe|offers|savings', bundle: 'Promos' },
];

const INITIAL_EMAILS = [
  {
    id: 'e1',
    isReminder: false,
    gmailId: null,
    threadId: null,
    messageIdHeader: null,
    gmailLabels: [],
    senderName: 'CARS_social, me',
    senderEmail: 'socialmedia@gm.com',
    subject: 'Help for long time Chevy Family - Gduck24 on GM-Trucks.com',
    snippet: 'I will be using the dealer for all of it. On Tue, Nov 17, 2026 at 9:27 AM CARS_socialmedia wrote...',
    body: 'Hi Grayson,\n\nI will be using the dealer for all of it. Thanks for reaching out regarding your 2020 Z71 and your long history with Chevy trucks.\n\nBest,\nCARS Social Media Team',
    htmlBody: null,
    note: 'Confirm dealer warranty coverage before Friday',
    timeLabel: '10:04 AM',
    bucket: 'Today',
    status: 'inbox',
    pinned: true,
    snoozedUntil: null,
    completedAt: null,
    unread: true,
  },
  {
    id: 'e2',
    isReminder: false,
    gmailId: null,
    threadId: null,
    messageIdHeader: null,
    gmailLabels: [],
    senderName: 'Kiel, me',
    senderEmail: 'kiel@classicchevy.com',
    subject: 'Your 2024 GMC Sierra 1500 Awaits? Test Drive This Week',
    snippet: 'I have good credit around 800. What is an estimate of the rates and terms that you guys can provide?',
    body: 'Hi Grayson,\n\nThanks for sending over your target numbers. With an 800 score, we can lock in tier-1 financing rates. Let me know what time works best for you to stop by.',
    htmlBody: null,
    note: '',
    timeLabel: '10:05 AM',
    bucket: 'Today',
    status: 'inbox',
    pinned: false,
    snoozedUntil: null,
    completedAt: null,
    unread: true,
  },
];

function decodeBase64Url(data) {
  if (!data) return '';
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extractGmailBodies(payload) {
  let plain = '';
  let html = '';

  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data && !plain) {
      plain = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }
    if (Array.isArray(part.parts)) {
      part.parts.forEach(walk);
    }
  };

  walk(payload);
  return { plain, html };
}

function classifyEmail(email, rules, bundleMap) {
  if (email.isReminder) return 'Primary';
  if (email.manualBundle && bundleMap[email.manualBundle]) {
    return email.manualBundle;
  }

  const senderStr = `${email.senderName} ${email.senderEmail}`.toLowerCase();
  const subjectStr = (email.subject || '').toLowerCase();
  const anyStr = `${senderStr} ${subjectStr} ${(email.snippet || '').toLowerCase()}`;

  for (const rule of rules) {
    if (!rule.pattern?.trim() || !bundleMap[rule.bundle]) continue;
    const tokens = rule.pattern
      .toLowerCase()
      .split('|')
      .map((t) => t.trim())
      .filter(Boolean);

    const target =
      rule.field === 'sender'
        ? senderStr
        : rule.field === 'subject'
        ? subjectStr
        : anyStr;

    if (tokens.some((tok) => target.includes(tok))) {
      return rule.bundle;
    }
  }

  const labels = email.gmailLabels || [];
  if (labels.includes('CATEGORY_UPDATES') && bundleMap['Updates']) return 'Updates';
  if (labels.includes('CATEGORY_PROMOTIONS') && bundleMap['Promos']) return 'Promos';
  if (labels.includes('CATEGORY_SOCIAL') && bundleMap['Social']) return 'Social';

  return 'Primary';
}

function parseEmlContent(rawText, fileName) {
  const lines = rawText.split(/\r?\n/);
  let subject = fileName.replace(/\.eml$/i, '');
  let from = 'Imported Sender <imported@example.com>';
  let bodyStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      bodyStartIdx = i + 1;
      break;
    }
    if (/^Subject:/i.test(line)) subject = line.replace(/^Subject:\s*/i, '').trim();
    if (/^From:/i.test(line)) from = line.replace(/^From:\s*/i, '').trim();
  }

  const emailMatch = from.match(/<([^>]+)>/);
  const senderEmail = emailMatch ? emailMatch[1] : from;
  const senderName = emailMatch ? from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || senderEmail : from;
  const rawBody = lines.slice(bodyStartIdx).join('\n').trim();
  const isHtml = /<html|<body|<div|<table/i.test(rawBody);
  const plainText = rawBody.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

  return {
    id: `eml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    isReminder: false,
    gmailId: null,
    threadId: null,
    messageIdHeader: null,
    gmailLabels: [],
    senderName,
    senderEmail,
    subject,
    snippet: plainText.slice(0, 140) || '(No preview text)',
    body: plainText || '(Empty message body)',
    htmlBody: isHtml ? rawBody : null,
    note: '',
    timeLabel: 'Just now',
    bucket: 'Today',
    status: 'inbox',
    pinned: false,
    snoozedUntil: null,
    completedAt: null,
    unread: true,
  };
}

export default function App() {
  const [bundles, setBundles] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_bundles_v1');
      return saved ? JSON.parse(saved) : DEFAULT_BUNDLES;
    } catch {
      return DEFAULT_BUNDLES;
    }
  });

  const [emails, setEmails] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_emails_v1');
      return saved ? JSON.parse(saved) : INITIAL_EMAILS;
    } catch {
      return INITIAL_EMAILS;
    }
