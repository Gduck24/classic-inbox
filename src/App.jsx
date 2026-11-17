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
  CheckCircle2,
} from 'lucide-react';

const BUILTIN_BUNDLES = {
  Primary: {
    id: 'Primary',
    label: 'Primary',
    color: '#4285F4',
    icon: Mail,
    inlineBundle: false,
    builtIn: true,
  },
  Updates: {
    id: 'Updates',
    label: 'Updates',
    color: '#FBBC05',
    icon: Bell,
    inlineBundle: true,
    builtIn: true,
  },
  Finance: {
    id: 'Finance',
    label: 'Finance',
    color: '#0F9D58',
    icon: Landmark,
    inlineBundle: true,
    builtIn: true,
  },
  Purchases: {
    id: 'Purchases',
    label: 'Purchases',
    color: '#8E24AA',
    icon: ShoppingBag,
    inlineBundle: true,
    builtIn: true,
  },
  Promos: {
    id: 'Promos',
    label: 'Promos',
    color: '#00ACC1',
    icon: Sparkles,
    inlineBundle: true,
    builtIn: true,
  },
  Social: {
    id: 'Social',
    label: 'Social',
    color: '#DB4437',
    icon: Users,
    inlineBundle: true,
    builtIn: true,
  },
  Travel: {
    id: 'Travel',
    label: 'Travel',
    color: '#3F51B5',
    icon: Plane,
    inlineBundle: true,
    builtIn: true,
  },
};

const CUSTOM_COLORS = ['#E91E63', '#009688', '#FF5722', '#673AB7', '#795548', '#607D8B'];

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
    note: '',
    timeLabel: '10:04 AM',
    bucket: 'Today',
    status: 'inbox',
    doneAt: null,
    pinned: true,
    snoozedUntil: null,
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
    doneAt: null,
    pinned: false,
    snoozedUntil: null,
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

function classifyEmail(email, rules, allBundles) {
  if (email.isReminder) return 'Primary';
  if (email.manualBundle && allBundles[email.manualBundle]) {
    return email.manualBundle;
  }

  const senderStr = `${email.senderName} ${email.senderEmail}`.toLowerCase();
  const subjectStr = (email.subject || '').toLowerCase();
  const anyStr = `${senderStr} ${subjectStr} ${(email.snippet || '').toLowerCase()}`;

  for (const rule of rules) {
    if (!rule.pattern?.trim() || !allBundles[rule.bundle]) continue;
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
  if (labels.includes('CATEGORY_UPDATES')) return 'Updates';
  if (labels.includes('CATEGORY_PROMOTIONS')) return 'Promos';
  if (labels.includes('CATEGORY_SOCIAL')) return 'Social';

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
    doneAt: null,
    pinned: false,
    snoozedUntil: null,
    unread: true,
  };
}

export default function App() {
  const [emails, setEmails] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_emails_v1');
      return saved ? JSON.parse(saved) : INITIAL_EMAILS;
    } catch {
      return INITIAL_EMAILS;
    }
  });

  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_rules_v1');
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch {
      return DEFAULT_RULES;
    }
  });

  const [customBundles, setCustomBundles] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_custom_bundles_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('classic_inbox_dark') === 'true');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('classic_inbox_compact') === 'true');

  const [activeNav, setActiveNav] = useState('inbox');
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBundles, setExpandedBundles] = useState({});
  const [openEmailId, setOpenEmailId] = useState(null);
  const [snoozePickerId, setSnoozePickerId] = useState(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);

  // Drag-and-drop & Mobile touch swipe states
  const [draggedEmailId, setDraggedEmailId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const touchStartRef = useRef({ id: null, x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState({ id: null, dx: 0 });

  // Form states
  const [newRule, setNewRule] = useState({ name: '', field: 'sender', pattern: '', bundle: 'Updates' });
  const [newBundleName, setNewBundleName] = useState('');
  const [newBundleColor, setNewBundleColor] = useState(CUSTOM_COLORS[0]);
  const [newReminderText, setNewReminderText] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('classic_inbox_client_id') || '');
  const [accessToken, setAccessToken] = useState(() => {
    const savedToken = localStorage.getItem('classic_inbox_token');
    const expiry = Number(localStorage.getItem('classic_inbox_token_expiry') || 0);
    if (savedToken && Date.now() < expiry - 60000) {
      return savedToken;
    }
    return null;
  });

  const [composeForm, setComposeForm] = useState({
    mode: 'new',
    to: '',
    subject: '',
    body: '',
    threadId: null,
    inReplyTo: null,
  });

  const allBundles = useMemo(() => {
    const map = { ...BUILTIN_BUNDLES };
    customBundles.forEach((cb) => {
      map[cb.id] = {
        id: cb.id,
        label: cb.label,
        color: cb.color,
        icon: Bell,
        inlineBundle: true,
        builtIn: false,
      };
    });
    return map;
  }, [customBundles]);

  useEffect(() => {
    try {
      localStorage.setItem('classic_inbox_emails_v1', JSON.stringify(emails));
    } catch {}
  }, [emails]);

  useEffect(() => {
    try {
      localStorage.setItem('classic_inbox_rules_v1', JSON.stringify(rules));
    } catch {}
  }, [rules]);

  useEffect(() => {
    try {
      localStorage.setItem('classic_inbox_custom_bundles_v1', JSON.stringify(customBundles));
    } catch {}
  }, [customBundles]);

  useEffect(() => {
    localStorage.setItem('classic_inbox_dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('classic_inbox_compact', String(compactMode));
  }, [compactMode]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  };

  const fetchGmailMessages = useCallback(
    async (token, pageToken = null) => {
      if (!token) return;
      setSyncing(true);
      try {
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        url.searchParams.set('maxResults', '100');
        url.searchParams.set('q', 'in:inbox');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const listRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (listRes.status === 401) {
          localStorage.removeItem('classic_inbox_token');
          localStorage.removeItem('classic_inbox_token_expiry');
          setAccessToken(null);
          setSyncing(false);
          return;
        }

        const listData = await listRes.json();
        setNextPageToken(listData.nextPageToken || null);

        if (listData.messages) {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const startOfYesterday = startOfToday - 86400000;

          const fetched = [];
          for (let i = 0; i < listData.messages.length; i += 20) {
            const chunk = listData.messages.slice(i, i + 20);
            const chunkResults = await Promise.all(
              chunk.map(async (m) => {
                const msgRes = await fetch(
                  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                const msgData = await msgRes.json();
                const headers = msgData.payload?.headers || [];
                const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Gmail Sender';
                const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
                const messageIdHeader = headers.find((h) => h.name.toLowerCase() === 'message-id')?.value || null;
                const internalTs = Number(msgData.internalDate || Date.now());
                const msgDate = new Date(internalTs);

                let bucket = 'Earlier this month';
                let timeLabel = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                if (internalTs >= startOfToday) {
                  bucket = 'Today';
                  timeLabel = msgDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                } else if (internalTs >= startOfYesterday) {
                  bucket = 'Yesterday';
                  timeLabel = 'Yesterday';
                }

                const { plain, html } = extractGmailBodies(msgData.payload);
                const emailMatch = from.match(/<([^>]+)>/);
                const labelIds = msgData.labelIds || [];

                return {
                  id: `gmail-${m.id}`,
                  isReminder: false,
                  gmailId: m.id,
                  threadId: msgData.threadId || null,
                  messageIdHeader,
                  gmailLabels: labelIds,
                  senderName: emailMatch ? from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() : from,
                  senderEmail: emailMatch ? emailMatch[1] : from,
                  subject,
                  snippet: msgData.snippet || '',
                  body: plain || msgData.snippet || '(No plain-text body)',
                  htmlBody: html || null,
                  note: '',
                  timeLabel,
                  bucket,
                  status: 'inbox',
                  doneAt: null,
                  pinned: false,
                  snoozedUntil: null,
                  unread: labelIds.includes('UNREAD'),
                };
              })
            );
            fetched.push(...chunkResults);
          }

          setEmails((prev) => {
            const reminders = prev.filter((item) => item.isReminder);
            const existingMap = new Map(prev.map((item) => [item.id, item]));
            const merged = fetched.map((f) => {
              const old = existingMap.get(f.id);
              return old
                ? {
                    ...f,
                    pinned: old.pinned,
                    status: old.status === 'snoozed' ? 'snoozed' : 'inbox',
                    snoozedUntil: old.snoozedUntil,
                    manualBundle: old.manualBundle,
                    note: old.note || '',
                  }
                : f;
            });
            if (pageToken) {
              const newIds = new Set(merged.map((m) => m.id));
              return [...prev.filter((p) => !newIds.has(p.id)), ...merged];
            }
            return [...reminders, ...merged];
          });

          showToast(`Synced ${fetched.length} inbox emails`);
        }
      } catch {
        showToast('Sync interrupted—try refreshing');
      } finally {
        setSyncing(false);
      }
    },
    []
  );

  const triggerGoogleAuth = useCallback(
    (clientIdToUse, silent = false) => {
      if (!clientIdToUse?.trim()) return;
      const runInit = () => {
        if (!window.google?.accounts?.oauth2) return;
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientIdToUse.trim(),
          scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
          prompt: silent ? '' : 'consent',
          callback: (tokenResponse) => {
            if (tokenResponse?.access_token) {
              const expiresInSec = Number(tokenResponse.expires_in || 3500);
              localStorage.setItem('classic_inbox_token', tokenResponse.access_token);
              localStorage.setItem('classic_inbox_token_expiry', String(Date.now() + expiresInSec * 1000));
              setAccessToken(tokenResponse.access_token);
              setConnectModalOpen(false);
              fetchGmailMessages(tokenResponse.access_token);
            }
          },
        });
        client.requestAccessToken();
      };

      const scriptId = 'google-gis-script';
      if (!document.getElementById(scriptId)) {
        const s = document.createElement('script');
        s.id = scriptId;
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = runInit;
        document.body.appendChild(s);
      } else {
        runInit();
      }
    },
    [fetchGmailMessages]
  );

  useEffect(() => {
    if (accessToken) {
      fetchGmailMessages(accessToken);
    } else if (googleClientId) {
      triggerGoogleAuth(googleClientId, true);
    }
  }, []);

  const classifiedEmails = useMemo(() => {
    return emails.map((e) => ({
      ...e,
      bundle: classifyEmail(e, rules, allBundles),
    }));
  }, [emails, rules, allBundles]);

  const visibleEmails = useMemo(() => {
    const filtered = classifiedEmails.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
