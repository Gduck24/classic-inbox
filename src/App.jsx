import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';

const BUNDLE_META = {
  Primary: {
    id: 'Primary',
    label: 'Primary',
    color: '#4285F4',
    icon: Mail,
    inlineBundle: false,
  },
  Updates: {
    id: 'Updates',
    label: 'Updates',
    color: '#FBBC05',
    icon: Bell,
    inlineBundle: true,
  },
  Finance: {
    id: 'Finance',
    label: 'Finance',
    color: '#0F9D58',
    icon: Landmark,
    inlineBundle: true,
  },
  Purchases: {
    id: 'Purchases',
    label: 'Purchases',
    color: '#8E24AA',
    icon: ShoppingBag,
    inlineBundle: true,
  },
  Promos: {
    id: 'Promos',
    label: 'Promos',
    color: '#00ACC1',
    icon: Sparkles,
    inlineBundle: true,
  },
  Social: {
    id: 'Social',
    label: 'Social',
    color: '#DB4437',
    icon: Users,
    inlineBundle: true,
  },
  Travel: {
    id: 'Travel',
    label: 'Travel',
    color: '#3F51B5',
    icon: Plane,
    inlineBundle: true,
  },
};

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
    gmailId: null,
    threadId: null,
    messageIdHeader: null,
    senderName: 'CARS_social, me',
    senderEmail: 'socialmedia@gm.com',
    subject: 'Help for long time Chevy Family - Gduck24 on GM-Trucks.com',
    snippet: 'I will be using the dealer for all of it. On Tue, Nov 17, 2026 at 9:27 AM CARS_socialmedia wrote...',
    body: 'Hi Grayson,\n\nI will be using the dealer for all of it. Thanks for reaching out regarding your 2020 Z71 and your long history with Chevy trucks.\n\nBest,\nCARS Social Media Team',
    htmlBody: null,
    timeLabel: '10:04 AM',
    bucket: 'Today',
    status: 'inbox',
    pinned: true,
    snoozedUntil: null,
    unread: true,
  },
  {
    id: 'e2',
    gmailId: null,
    threadId: null,
    messageIdHeader: null,
    senderName: 'Kiel, me',
    senderEmail: 'kiel@classicchevy.com',
    subject: 'Your 2024 GMC Sierra 1500 Awaits? Test Drive This Week',
    snippet: 'I have good credit around 800. What is an estimate of the rates and terms that you guys can provide?',
    body: 'Hi Grayson,\n\nThanks for sending over your target numbers. With an 800 score, we can lock in tier-1 financing rates. Let me know what time works best for you to stop by.',
    htmlBody: null,
    timeLabel: '10:05 AM',
    bucket: 'Today',
    status: 'inbox',
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

function classifyEmail(email, rules) {
  if (email.manualBundle && BUNDLE_META[email.manualBundle]) {
    return email.manualBundle;
  }
  const senderStr = `${email.senderName} ${email.senderEmail}`.toLowerCase();
  const subjectStr = (email.subject || '').toLowerCase();
  const anyStr = `${senderStr} ${subjectStr} ${(email.snippet || '').toLowerCase()} ${(email.body || '').toLowerCase()}`;

  for (const rule of rules) {
    if (!rule.pattern?.trim()) continue;
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
    gmailId: null,
    threadId: null,
    messageIdHeader: null,
    senderName,
    senderEmail,
    subject,
    snippet: plainText.slice(0, 140) || '(No preview text)',
    body: plainText || '(Empty message body)',
    htmlBody: isHtml ? rawBody : null,
    timeLabel: 'Just now',
    bucket: 'Today',
    status: 'inbox',
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
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const [newRule, setNewRule] = useState({ name: '', field: 'sender', pattern: '', bundle: 'Updates' });
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('classic_inbox_client_id') || '');
  const [accessToken, setAccessToken] = useState(null);
  const [composeForm, setComposeForm] = useState({
    mode: 'new',
    to: '',
    subject: '',
    body: '',
    threadId: null,
    inReplyTo: null,
  });

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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const classifiedEmails = useMemo(() => {
    return emails.map((e) => ({
      ...e,
      bundle: classifyEmail(e, rules),
    }));
  }, [emails, rules]);

  const visibleEmails = useMemo(() => {
    return classifiedEmails.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${e.senderName} ${e.senderEmail} ${e.subject} ${e.snippet} ${e.body}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (activeNav === 'inbox') {
        if (e.status !== 'inbox') return false;
        if (pinnedOnly && !e.pinned) return false;
        return true;
      }
      if (activeNav === 'snoozed') return e.status === 'snoozed';
      if (activeNav === 'done') return e.status === 'done';
      if (activeNav.startsWith('bundle:')) {
        const bName = activeNav.replace('bundle:', '');
        return e.status !== 'done' && e.bundle === bName;
      }
      return true;
    });
  }, [classifiedEmails, activeNav, pinnedOnly, searchQuery]);

  const modifyGmailLabels = async (gmailId, addLabelIds = [], removeLabelIds = []) => {
    if (!accessToken || !gmailId) return;
    try {
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      });
    } catch {}
  };

  const togglePin = (id, ev) => {
    ev?.stopPropagation();
    setEmails((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, pinned: !e.pinned, status: e.status === 'done' ? 'inbox' : e.status } : e
      )
    );
  };

  const markDone = (id, ev) => {
    ev?.stopPropagation();
    const target = emails.find((e) => e.id === id);
    if (target?.gmailId) modifyGmailLabels(target.gmailId, [], ['INBOX']);
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'done', pinned: false } : e)));
    if (openEmailId === id) setOpenEmailId(null);
    showToast(accessToken && target?.gmailId ? 'Archived in Gmail' : 'Marked Done');
  };

  const trashEmail = (id, ev) => {
    ev?.stopPropagation();
    const target = emails.find((e) => e.id === id);
    if (target?.gmailId) modifyGmailLabels(target.gmailId, ['TRASH'], ['INBOX']);
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (openEmailId === id) setOpenEmailId(null);
    showToast('Moved to Trash');
  };

  const moveBackToInbox = (id, ev) => {
    ev?.stopPropagation();
    const target = emails.find((e) => e.id === id);
    if (target?.gmailId) modifyGmailLabels(target.gmailId, ['INBOX'], []);
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'inbox', snoozedUntil: null } : e)));
    showToast('Moved back to Inbox');
  };

  const snoozeEmail = (id, label, ev) => {
    ev?.stopPropagation();
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'snoozed', pinned: false, snoozedUntil: label } : e))
    );
    setSnoozePickerId(null);
    if (openEmailId === id) setOpenEmailId(null);
    showToast(`Snoozed until ${label}`);
  };

  const openReplyComposer = (email) => {
    const cleanSubj = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
    setComposeForm({
      mode: 'reply',
      to: email.senderEmail,
      subject: cleanSubj,
      body: `\n\n--- On ${email.timeLabel}, ${email.senderName} wrote: ---\n${email.body}`,
      threadId: email.threadId || null,
      inReplyTo: email.messageIdHeader || null,
    });
    setComposeOpen(true);
  };

  const openForwardComposer = (email) => {
    const cleanSubj = /^fwd:/i.test(email.subject) ? email.subject : `Fwd: ${email.subject}`;
    setComposeForm({
      mode: 'forward',
      to: '',
      subject: cleanSubj,
      body: `\n\n---------- Forwarded message ---------\nFrom: ${email.senderName} <${email.senderEmail}>\nSubject: ${email.subject}\n\n${email.body}`,
      threadId: null,
      inReplyTo: null,
    });
    setComposeOpen(true);
  };

  const handleSendEmail = async () => {
    if (!composeForm.to.trim()) {
      showToast('Enter a recipient email address');
      return;
    }

    if (accessToken) {
      try {
        const headers = [
          `To: ${composeForm.to.trim()}`,
          `Subject: ${composeForm.subject}`,
          'Content-Type: text/plain; charset="UTF-8"',
        ];
        if (composeForm.inReplyTo) {
          headers.push(`In-Reply-To: ${composeForm.inReplyTo}`);
          headers.push(`References: ${composeForm.inReplyTo}`);
        }
        const rawMime = `${headers.join('\r\n')}\r\n\r\n${composeForm.body}`;
        const payload = { raw: encodeBase64Url(rawMime) };
        if (composeForm.threadId) payload.threadId = composeForm.threadId;

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setComposeOpen(false);
          setComposeForm({ mode: 'new', to: '', subject: '', body: '', threadId: null, inReplyTo: null });
          showToast('Sent via Gmail!');
          return;
        }
      } catch {}
    }

    setComposeOpen(false);
    setComposeForm({ mode: 'new', to: '', subject: '', body: '', threadId: null, inReplyTo: null });
    showToast(accessToken ? 'Failed to send via Gmail' : 'Connect Gmail first to send live emails');
  };

  const sweepBundle = (bucket, bundleName, ev) => {
    ev?.stopPropagation();
    setEmails((prev) =>
      prev.map((e) => {
        const b = classifyEmail(e, rules);
        if (e.status === 'inbox' && e.bucket === bucket && b === bundleName && !e.pinned) {
          if (e.gmailId) modifyGmailLabels(e.gmailId, [], ['INBOX']);
          return { ...e, status: 'done' };
        }
        return e;
      })
    );
    showToast(`Swept ${bundleName} in ${bucket}`);
  };

  const sweepBucket = (bucket) => {
    setEmails((prev) =>
      prev.map((e) => {
        if (e.status === 'inbox' && e.bucket === bucket && !e.pinned) {
          if (e.gmailId) modifyGmailLabels(e.gmailId, [], ['INBOX']);
          return { ...e, status: 'done' };
        }
        return e;
      })
    );
    showToast(`Swept unpinned items in ${bucket}`);
  };

  const assignSenderRule = (email, targetBundle) => {
    const cleanPattern = email.senderEmail.toLowerCase();
    const ruleId = `r-${Date.now()}`;
    setRules((prev) => [
      {
        id: ruleId,
        name: `${email.senderName} -> ${targetBundle}`,
        field: 'sender',
        pattern: cleanPattern,
        bundle: targetBundle,
      },
      ...prev,
    ]);
    setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, manualBundle: targetBundle } : e)));
    showToast(`Future messages from ${email.senderName} -> ${targetBundle}`);
  };

  const handleEmlFiles = async (fileList) => {
    const imported = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.eml')) continue;
      const text = await file.text();
      imported.push(parseEmlContent(text, file.name));
    }
    if (imported.length > 0) {
      setEmails((prev) => [...imported, ...prev]);
      setConnectModalOpen(false);
      showToast(`Imported ${imported.length} email(s)`);
    }
  };

  const connectGoogleOAuth = () => {
    if (!googleClientId.trim()) {
      showToast('Enter your Google OAuth Client ID first');
      return;
    }
    localStorage.setItem('classic_inbox_client_id', googleClientId.trim());
    const scriptId = 'google-gis-script';
    const initTokenClient = () => {
      if (!window.google?.accounts?.oauth2) {
        showToast('Google Identity script still loading—try again in 1 second');
        return;
      }
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId.trim(),
        scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
        callback: async (tokenResponse) => {
          if (tokenResponse?.access_token) {
            setAccessToken(tokenResponse.access_token);
            setConnectModalOpen(false);
            showToast('Connected to Gmail! Downloading full threads...');
            try {
              const listRes = await fetch(
                'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=in:inbox',
                { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
              );
              const listData = await listRes.json();
              if (listData.messages) {
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const startOfYesterday = startOfToday - 86400000;

                const fetched = await Promise.all(
                  listData.messages.map(async (m) => {
                    const msgRes = await fetch(
                      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
                      { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
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

                    return {
                      id: `gmail-${m.id}`,
                      gmailId: m.id,
                      threadId: msgData.threadId || null,
                      messageIdHeader,
                      senderName: emailMatch ? from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() : from,
                      senderEmail: emailMatch ? emailMatch[1] : from,
                      subject,
                      snippet: msgData.snippet || '',
                      body: plain || msgData.snippet || '(No plain-text body)',
                      htmlBody: html || null,
                      timeLabel,
                      bucket,
                      status: 'inbox',
                      pinned: false,
                      snoozedUntil: null,
                      unread: (msgData.labelIds || []).includes('UNREAD'),
                    };
                  })
                );
                setEmails(fetched);
                showToast(`Synced ${fetched.length} full Gmail messages`);
              }
            } catch {
              showToast('Connected, but could not fetch messages');
            }
          }
        },
      });
      client.requestAccessToken();
    };

    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = initTokenClient;
      document.body.appendChild(s);
    } else {
      initTokenClient();
    }
  };

  const simulateWakeSnoozed = () => {
    setEmails((prev) =>
      prev.map((e) =>
        e.status === 'snoozed' ? { ...e, status: 'inbox', bucket: 'Today', timeLabel: 'Snoozed -> Now', snoozedUntil: null } : e
      )
    );
    setActiveNav('inbox');
    showToast('Snoozed items returned to Today');
  };

  const resetDemoData = () => {
    setEmails(INITIAL_EMAILS);
    setRules(DEFAULT_RULES);
    showToast('Sample data & rules reset');
  };

  const openEmail = classifiedEmails.find((e) => e.id === openEmailId);
  const headerColor =
    activeNav === 'done'
      ? 'bg-[#0F9D58]'
      : activeNav === 'snoozed'
      ? 'bg-[#EF6C00]'
      : 'bg-[#4285F4]';

  const renderEmailRow = (email, nested = false) => {
    const meta = BUNDLE_META[email.bundle] || BUNDLE_META.Primary;
    return (
      <div
        key={email.id}
        onClick={() => {
          setOpenEmailId(email.id);
          if (email.unread && email.gmailId) modifyGmailLabels(email.gmailId, [], ['UNREAD']);
          setEmails((prev) => prev.map((item) => (item.id === email.id ? { ...item, unread: false } : item)));
        }}
        className={`group relative flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors ${
          nested ? 'pl-8 bg-slate-50/40' : ''
        }`}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
          style={{ backgroundColor: meta.color }}
        >
          {(email.senderName || '?')[0].toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${email.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
              {email.senderName}
            </span>
            <span className="text-xs text-gray-400 shrink-0 group-hover:hidden">{email.timeLabel}</span>
          </div>
          <div className="text-sm text-gray-800 truncate">
            <span className={email.unread ? 'font-semibold' : ''}>{email.subject}</span>
            <span className="text-gray-400"> — {email.snippet}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
          <button
            title="Pin to Inbox"
            onClick={(ev) => togglePin(email.id, ev)}
            className={`p-2 rounded-full hover:bg-gray-200 ${email.pinned ? 'text-blue-600 opacity-100' : 'text-gray-500'}`}
          >
            <Pin className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              title="Snooze"
              onClick={(ev) => {
                ev.stopPropagation();
                setSnoozePickerId(snoozePickerId === email.id ? null : email.id);
              }}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-500"
            >
              <Clock className="w-4 h-4" />
            </button>
            {snoozePickerId === email.id && (
              <div
                onClick={(ev) => ev.stopPropagation()}
                className="absolute right-0 top-9 z-30 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1 text-sm"
              >
                {['Later today (6 PM)', 'Tomorrow (8 AM)', 'Next week (Mon)'].map((slot) => (
                  <button
                    key={slot}
                    onClick={(ev) => snoozeEmail(email.id, slot, ev)}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 text-gray-700"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {email.status === 'done' ? (
            <button
              title="Move back to Inbox"
              onClick={(ev) => moveBackToInbox(email.id, ev)}
              className="p-2 rounded-full hover:bg-blue-100 text-blue-600"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <button
              title="Mark Done"
              onClick={(ev) => markDone(email.id, ev)}
              className="p-2 rounded-full hover:bg-emerald-100 text-emerald-600"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const buckets = ['Today', 'Yesterday', 'Earlier this month'];

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer?.files?.length) handleEmlFiles(e.dataTransfer.files);
      }}
      className="h-full flex flex-col bg-[#f2f2f2] overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className={`${headerColor} text-white shadow-md px-3 sm:px-5 h-14 flex items-center justify-between gap-3 shrink-0 transition-colors`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-full hover:bg-white/15 transition-colors"
            aria-label="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-lg tracking-tight">
            {activeNav === 'inbox'
              ? 'Inbox'
              : activeNav === 'snoozed'
              ? 'Snoozed'
              : activeNav === 'done'
              ? 'Done'
              : activeNav.replace('bundle:', '')}
          </span>
        </div>

        <div className="flex-1 max-w-xl">
          <div className="relative flex items-center bg-white/20 focus-within:bg-white focus-within:text-gray-900 rounded-md px-3 py-1.5 transition-colors">
            <Search className="w-4 h-4 mr-2 opacity-80 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail & bundles..."
              className="w-full bg-transparent text-sm placeholder-white/80 focus:placeholder-gray-400 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="ml-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeNav === 'inbox' && (
            <button
              onClick={() => setPinnedOnly((p) => !p)}
              title="Show Pinned Only"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                pinnedOnly ? 'bg-white text-blue-600 shadow' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pinned</span>
            </button>
          )}
          <button
            onClick={() => setConnectModalOpen(true)}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{accessToken ? 'Sync Gmail' : 'Connect / .EML'}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && (
          <aside className="w-60 bg-white border-r border-gray-200 flex flex-col justify-between py-3 shrink-0 z-20 absolute md:static inset-y-0 left-0 shadow-lg md:shadow-none">
            <div className="overflow-y-auto px-2 space-y-1">
              {[
                { id: 'inbox', label: 'Inbox', icon: InboxIcon, color: 'text-blue-600' },
                { id: 'snoozed', label: 'Snoozed', icon: Clock, color: 'text-amber-600' },
                { id: 'done', label: 'Done', icon: CheckCheck, color: 'text-emerald-600' },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveNav(item.id);
                      setOpenEmailId(null);
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <div className="pt-3 pb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Bundles
              </div>
              {Object.values(BUNDLE_META)
                .filter((b) => b.id !== 'Primary')
                .map((b) => {
                  const Icon = b.icon;
                  const active = activeNav === `bundle:${b.id}`;
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        setActiveNav(`bundle:${b.id}`);
                        setOpenEmailId(null);
                        if (window.innerWidth < 768) setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" style={{ color: b.color }} />
                      <span>{b.label}</span>
                    </button>
                  );
                })}
            </div>

            <div className="px-2 pt-2 border-t border-gray-100 space-y-1">
              <button
                onClick={() => setRuleModalOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 font-medium"
              >
                <Settings className="w-4 h-4 text-gray-500" />
                <span>Edit Routing Rules</span>
              </button>
              <button
                onClick={resetDemoData}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto px-2 sm:px-6 py-4">
          <div className="max-w-4xl mx-auto pb-20">
            {openEmail ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Action Toolbar */}
                <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gray-50">
                  <button
                    onClick={() => setOpenEmailId(null)}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <select
                      value={openEmail.bundle}
                      onChange={(e) => assignSenderRule(openEmail, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-700"
                      title="Always route this sender to bundle"
                    >
                      {Object.keys(BUNDLE_META).map((bKey) => (
                        <option key={bKey} value={bKey}>
                          Bundle: {bKey}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => openReplyComposer(openEmail)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-200 text-xs font-medium text-gray-700"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                      <span className="hidden sm:inline">Reply</span>
                    </button>

                    <button
                      onClick={() => openForwardComposer(openEmail)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-200 text-xs font-medium text-gray-700"
                      title="Forward"
                    >
                      <Forward className="w-4 h-4" />
                      <span className="hidden sm:inline">Forward</span>
                    </button>

                    <div className="relative">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSnoozePickerId(snoozePickerId === openEmail.id ? null : openEmail.id);
                        }}
                        className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
                        title="Snooze"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      {snoozePickerId === openEmail.id && (
                        <div
                          onClick={(ev) => ev.stopPropagation()}
                          className="absolute right-0 top-9 z-30 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1 text-sm"
                        >
                          {['Later today (6 PM)', 'Tomorrow (8 AM)', 'Next week (Mon)'].map((slot) => (
                            <button
                              key={slot}
                              onClick={(ev) => snoozeEmail(openEmail.id, slot, ev)}
                              className="w-full text-left px-3 py-2 hover:bg-amber-50 text-gray-700"
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(ev) => togglePin(openEmail.id, ev)}
                      className={`p-2 rounded-full hover:bg-gray-200 ${openEmail.pinned ? 'text-blue-600' : 'text-gray-500'}`}
                      title="Pin"
                    >
                      <Pin className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(ev) => trashEmail(openEmail.id, ev)}
                      className="p-2 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(ev) => markDone(openEmail.id, ev)}
                      className="p-2 rounded-full hover:bg-emerald-100 text-emerald-600"
                      title="Done / Archive"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-5 sm:p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">{openEmail.subject}</h2>
                  <div className="flex items-center justify-between text-sm text-gray-500 pb-4 mb-4 border-b border-gray-100">
                    <div>
                      <span className="font-semibold text-gray-800">{openEmail.senderName}</span>{' '}
                      <span className="text-xs">&lt;{openEmail.senderEmail}&gt;</span>
                    </div>
                    <span className="text-xs">{openEmail.timeLabel}</span>
                  </div>

                  {openEmail.htmlBody ? (
                    <iframe
                      title="Email Content"
                      srcDoc={openEmail.htmlBody}
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      className="w-full min-h-[480px] border-0 rounded bg-white"
                    />
                  ) : (
                    <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{openEmail.body}</div>
                  )}

                  {/* Bottom Quick Reply / Forward Bar */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
                    <button
                      onClick={() => openReplyComposer(openEmail)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700"
                    >
                      <Reply className="w-4 h-4" />
                      <span>Reply</span>
                    </button>
                    <button
                      onClick={() => openForwardComposer(openEmail)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700"
                    >
                      <Forward className="w-4 h-4" />
                      <span>Forward</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : activeNav === 'inbox' ? (
              buckets.map((bucket) => {
                const bucketItems = visibleEmails.filter((e) => e.bucket === bucket);
                if (bucketItems.length === 0) return null;

                const directItems = bucketItems.filter((e) => !BUNDLE_META[e.bundle]?.inlineBundle);
                const bundledGroups = {};
                bucketItems
                  .filter((e) => BUNDLE_META[e.bundle]?.inlineBundle)
                  .forEach((e) => {
                    if (!bundledGroups[e.bundle]) bundledGroups[e.bundle] = [];
                    bundledGroups[e.bundle].push(e);
                  });

                return (
                  <section key={bucket} className="mb-6">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{bucket}</h3>
                      <button
                        onClick={() => sweepBucket(bucket)}
                        className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Sweep unpinned</span>
                      </button>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      {directItems.map((email) => renderEmailRow(email, false))}

                      {Object.entries(bundledGroups).map(([bundleName, items]) => {
                        const meta = BUNDLE_META[bundleName];
                        const Icon = meta.icon;
                        const expandKey = `${bucket}-${bundleName}`;
                        const isExpanded = !!expandedBundles[expandKey];

                        return (
                          <div key={expandKey} className="border-b border-gray-100 last:border-b-0">
                            <div
                              onClick={() =>
                                setExpandedBundles((prev) => ({ ...prev, [expandKey]: !prev[expandKey] }))
                              }
                              className="group flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: meta.color }}
                              >
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm" style={{ color: meta.color }}>
                                    {meta.label} ({items.length})
                                  </span>
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {items.map((i) => i.senderName.split(',')[0]).join(', ')}
                                </div>
                              </div>

                              <button
                                title={`Sweep ${meta.label}`}
                                onClick={(ev) => sweepBundle(bucket, bundleName, ev)}
                                className="p-2 rounded-full hover:bg-emerald-100 text-emerald-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              >
                                <CheckCheck className="w-4 h-4" />
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-gray-100">
                                {items.map((item) => renderEmailRow(item, true))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            ) : (
              <div>
                {activeNav === 'snoozed' && visibleEmails.length > 0 && (
                  <div className="mb-3 flex justify-end">
                    <button
                      onClick={simulateWakeSnoozed}
                      className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-full shadow-sm hover:bg-amber-700"
                    >
                      Simulate Time Passing (Wake Snoozed)
                    </button>
                  </div>
                )}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {visibleEmails.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 text-sm">
                      All clear! Nothing here right now.
                    </div>
                  ) : (
                    visibleEmails.map((email) => renderEmailRow(email, false))
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <button
        onClick={() => {
          setComposeForm({ mode: 'new', to: '', subject: '', body: '', threadId: null, inReplyTo: null });
          setComposeOpen(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#DB4437] hover:bg-[#c53929] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-30"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        title="Compose"
      >
        <Plus className="w-6 h-6" />
      </button>

      {ruleModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Deterministic Routing Rules (First Match Wins)</h3>
              <button onClick={() => setRuleModalOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-gray-500">
                Rules run from top to bottom. As soon as an email matches one rule, it stops—preventing duplicates across sections.
              </p>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newRule.field}
                    onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
                    className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                  >
                    <option value="sender">Sender contains</option>
                    <option value="subject">Subject contains</option>
                    <option value="any">Any text contains</option>
                  </select>
                  <select
                    value={newRule.bundle}
                    onChange={(e) => setNewRule({ ...newRule, bundle: e.target.value })}
                    className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                  >
                    {Object.keys(BUNDLE_META).map((b) => (
                      <option key={b} value={b}>
                        Route to: {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Keywords separated by | (e.g. receipt|invoice)"
                    value={newRule.pattern}
                    onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                    className="flex-1 text-xs border border-gray-300 rounded px-2.5 py-1.5"
                  />
                  <button
                    onClick={() => {
                      if (!newRule.pattern.trim()) return;
                      setRules((prev) => [
                        {
                          id: `r-${Date.now()}`,
                          name: `${newRule.pattern} -> ${newRule.bundle}`,
                          field: newRule.field,
                          pattern: newRule.pattern.trim(),
                          bundle: newRule.bundle,
                        },
                        ...prev,
                      ]);
                      setNewRule({ name: '', field: 'sender', pattern: '', bundle: 'Updates' });
                    }}
                    className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {rules.map((r, idx) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 border border-gray-200 rounded-lg text-xs">
                    <div>
                      <span className="font-bold text-gray-400 mr-2">#{idx + 1}</span>
                      <span className="font-semibold text-gray-800">{r.bundle}</span>
                      <span className="text-gray-500 ml-2">
                        ({r.field}: <code className="bg-gray-100 px-1 rounded">{r.pattern}</code>)
                      </span>
                    </div>
                    <button
                      onClick={() => setRules((prev) => prev.filter((item) => item.id !== r.id))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {connectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Import .EML or Connect Live Gmail</h3>
              <button onClick={() => setConnectModalOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Option 1: Upload .EML Files
                </h4>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition-colors">
                  <Upload className="w-6 h-6 text-blue-600 mb-1" />
                  <span className="text-xs font-medium text-gray-700">Click to select .eml files (or drag anywhere)</span>
                  <input
                    type="file"
                    accept=".eml"
                    multiple
                    onChange={(e) => e.target.files && handleEmlFiles(e.target.files)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Option 2: Live Gmail API (Google OAuth)
                </h4>
                <input
                  type="text"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="Paste Google Cloud OAuth Client ID..."
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 mb-2"
                />
                <button
                  onClick={connectGoogleOAuth}
                  className="w-full bg-[#4285F4] hover:bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Sign in with Google & Sync Inbox
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {composeOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-800 text-white flex items-center justify-between">
              <span className="text-sm font-medium">
                {composeForm.mode === 'reply'
                  ? 'Reply'
                  : composeForm.mode === 'forward'
                  ? 'Forward Message'
                  : 'New Message'}
              </span>
              <button onClick={() => setComposeOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="email"
                placeholder="To"
                value={composeForm.to}
                onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                className="w-full text-sm border-b border-gray-200 pb-2 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Subject"
                value={composeForm.subject}
                onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                className="w-full text-sm border-b border-gray-200 pb-2 focus:outline-none"
              />
              <textarea
                rows={7}
                placeholder="Write your message..."
                value={composeForm.body}
                onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                className="w-full text-sm focus:outline-none resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSendEmail}
                  className="flex items-center gap-1.5 bg-[#4285F4] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-600"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{accessToken ? 'Send via Gmail' : 'Send'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
