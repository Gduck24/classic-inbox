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
  Moon,
  Sun,
  AlignJustify,
  StickyNote,
  FolderPlus,
  BellRing,
  Calendar as CalendarIcon,
  ListTodo,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Tag,
} from 'lucide-react';

const ICON_MAP = {
  Mail,
  Bell,
  Landmark,
  ShoppingBag,
  Sparkles,
  Users,
  Plane,
  Tag,
  BellRing,
};

const DEFAULT_BUNDLES = [
  { id: 'Primary', label: 'Primary', color: '#4285F4', iconName: 'Mail', inlineBundle: false, custom: false },
  { id: 'Updates', label: 'Updates', color: '#FBBC05', iconName: 'Bell', inlineBundle: true, custom: false },
  { id: 'Finance', label: 'Finance & Bills', color: '#0F9D58', iconName: 'Landmark', inlineBundle: true, custom: false },
  { id: 'Purchases', label: 'Purchases', color: '#8E24AA', iconName: 'ShoppingBag', inlineBundle: true, custom: false },
  { id: 'Promos', label: 'Promos', color: '#00ACC1', iconName: 'Sparkles', inlineBundle: true, custom: false },
  { id: 'Social', label: 'Social', color: '#DB4437', iconName: 'Users', inlineBundle: true, custom: false },
];

const DEFAULT_RULES = [
  { id: 'r1', name: 'Kickstarter -> Updates', field: 'sender', pattern: 'kickstarter', bundle: 'Updates' },
  { id: 'r2', name: 'Invoices & Bills -> Finance', field: 'any', pattern: 'invoice|balance due|statement|payment request|bill', bundle: 'Finance' },
  { id: 'r3', name: 'Receipts & Orders -> Purchases', field: 'any', pattern: 'receipt|order confirmation|rma|shipped', bundle: 'Purchases' },
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
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  return { plain, html };
}

function classifyEmail(email, rules, bundleMap) {
  if (email.isReminder) return 'Primary';
  if (email.manualBundle && bundleMap[email.manualBundle]) return email.manualBundle;

  const senderStr = `${email.senderName} ${email.senderEmail}`.toLowerCase();
  const subjectStr = (email.subject || '').toLowerCase();
  const anyStr = `${senderStr} ${subjectStr} ${(email.snippet || '').toLowerCase()}`;

  for (const rule of rules) {
    if (!rule.pattern?.trim() || !bundleMap[rule.bundle]) continue;
    const tokens = rule.pattern.toLowerCase().split('|').map((t) => t.trim()).filter(Boolean);
    const target = rule.field === 'sender' ? senderStr : rule.field === 'subject' ? subjectStr : anyStr;
    if (tokens.some((tok) => target.includes(tok))) return rule.bundle;
  }
  return 'Primary';
}

export default function App() {
  const [bundles, setBundles] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_bundles_v4');
      return saved ? JSON.parse(saved) : DEFAULT_BUNDLES;
    } catch {
      return DEFAULT_BUNDLES;
    }
  });

  const [emails, setEmails] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_emails_v4');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem('classic_inbox_rules_v4');
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch {
      return DEFAULT_RULES;
    }
  });

  const [tasks, setTasks] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarError, setCalendarError] = useState(false);

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('classic_inbox_dark') === 'true');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('classic_inbox_compact') === 'true');

  const [activeNav, setActiveNav] = useState('inbox');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Gmail-style right side panel state: null | 'calendar' | 'tasks'
  const [activeRightPanel, setActiveRightPanel] = useState('tasks');

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBundles, setExpandedBundles] = useState({});
  const [openEmailId, setOpenEmailId] = useState(null);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('classic_inbox_client_id') || '');
  const [accessToken, setAccessToken] = useState(() => {
    const savedToken = localStorage.getItem('classic_inbox_token');
    const expiry = Number(localStorage.getItem('classic_inbox_token_expiry') || 0);
    return savedToken && Date.now() < expiry - 60000 ? savedToken : null;
  });

  const [composeForm, setComposeForm] = useState({ mode: 'new', to: '', subject: '', body: '', threadId: null, inReplyTo: null });

  useEffect(() => { localStorage.setItem('classic_inbox_bundles_v4', JSON.stringify(bundles)); }, [bundles]);
  useEffect(() => { localStorage.setItem('classic_inbox_emails_v4', JSON.stringify(emails)); }, [emails]);
  useEffect(() => { localStorage.setItem('classic_inbox_rules_v4', JSON.stringify(rules)); }, [rules]);
  useEffect(() => { localStorage.setItem('classic_inbox_dark', String(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem('classic_inbox_compact', String(compactMode)); }, [compactMode]);

  const bundleMap = useMemo(() => {
    const map = {};
    bundles.forEach((b) => { map[b.id] = b; });
    return map;
  }, [bundles]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const fetchCalendarEvents = useCallback(async (token) => {
    if (!token) return;
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfRange = new Date(startOfDay.getTime() + 14 * 86400000);
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('timeMin', startOfDay.toISOString());
      url.searchParams.set('timeMax', endOfRange.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');

      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setCalendarError(true); return; }
      setCalendarError(false);
      const data = await res.json();
      setCalendarEvents(data.items || []);
    } catch {
      setCalendarError(true);
    }
  }, []);

  const fetchGoogleTasks = useCallback(async (token) => {
    if (!token) return;
    try {
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setTasks(data.items.map((t) => ({ id: t.id, text: t.title, done: t.status === 'completed', googleTaskId: t.id })));
        }
      }
    } catch {}
  }, []);

  const addGoogleTask = async (text) => {
    if (!text.trim()) return;
    const tempId = `task-${Date.now()}`;
    const newTask = { id: tempId, text: text.trim(), done: false };
    setTasks((prev) => [newTask, ...prev]);

    if (accessToken) {
      try {
        const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.trim() }),
        });
        const data = await res.json();
        if (data.id) {
          setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: data.id, googleTaskId: data.id } : t)));
        }
      } catch {}
    }
  };

  const toggleGoogleTask = async (task) => {
    const nextDone = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: nextDone } : t)));
    if (accessToken && task.googleTaskId) {
      try {
        await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.googleTaskId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextDone ? 'completed' : 'needsAction' }),
        });
      } catch {}
    }
  };

  const deleteGoogleTask = async (task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    if (accessToken && task.googleTaskId) {
      try {
        await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${task.googleTaskId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {}
    }
  };

  const fetchGmailMessages = useCallback(async (token, pageToken = null) => {
    if (!token) return;
    setSyncing(true);
    try {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('maxResults', '50');
      url.searchParams.set('q', 'in:inbox');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const listRes = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (listRes.status === 401) {
        localStorage.removeItem('classic_inbox_token');
        setAccessToken(null);
        setSessionExpired(true);
        setSyncing(false);
        return;
      }
      setSessionExpired(false);
      const listData = await listRes.json();
      setNextPageToken(listData.nextPageToken || null);

      if (listData.messages) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 86400000;

        const fetched = [];
        for (let i = 0; i < listData.messages.length; i += 15) {
          const chunk = listData.messages.slice(i, i + 15);
          const chunkResults = await Promise.all(
            chunk.map(async (m) => {
              const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const msgData = await msgRes.json();
              const headers = msgData.payload?.headers || [];
              const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Gmail Sender';
              const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
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
                gmailLabels: labelIds,
                senderName: emailMatch ? from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() : from,
                senderEmail: emailMatch ? emailMatch[1] : from,
                subject,
                snippet: msgData.snippet || '',
                body: plain || msgData.snippet || '',
                htmlBody: html || null,
                note: '',
                timeLabel,
                bucket,
                status: 'inbox',
                pinned: false,
                snoozedUntil: null,
                completedAt: null,
                unread: labelIds.includes('UNREAD'),
              };
            })
          );
          fetched.push(...chunkResults);
        }

        setEmails((prev) => {
          const existingMap = new Map(prev.map((item) => [item.id, item]));
          return fetched.map((f) => {
            const old = existingMap.get(f.id);
            return old ? { ...f, pinned: old.pinned, note: old.note || '', status: old.status, snoozedUntil: old.snoozedUntil, manualBundle: old.manualBundle } : f;
          });
        });
        showToast(`Synced ${fetched.length} emails`);
      }
    } catch {
      showToast('Sync interrupted');
    } finally {
      setSyncing(false);
    }
  }, []);

  const triggerGoogleAuth = useCallback((clientIdToUse) => {
    if (!clientIdToUse?.trim()) return;
    const runInit = () => {
      if (!window.google?.accounts?.oauth2) return;
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientIdToUse.trim(),
        scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks',
        callback: (tokenResponse) => {
          if (tokenResponse?.access_token) {
            const expiresInSec = Number(tokenResponse.expires_in || 3500);
            localStorage.setItem('classic_inbox_token', tokenResponse.access_token);
            localStorage.setItem('classic_inbox_token_expiry', String(Date.now() + expiresInSec * 1000));
            setAccessToken(tokenResponse.access_token);
            setSessionExpired(false);
            setConnectModalOpen(false);
            fetchGmailMessages(tokenResponse.access_token);
            fetchCalendarEvents(tokenResponse.access_token);
            fetchGoogleTasks(tokenResponse.access_token);
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
  }, [fetchGmailMessages, fetchCalendarEvents, fetchGoogleTasks]);

  useEffect(() => {
    if (accessToken) {
      fetchGmailMessages(accessToken);
      fetchCalendarEvents(accessToken);
      fetchGoogleTasks(accessToken);
    } else if (googleClientId) {
      setSessionExpired(true);
    }
  }, [accessToken, googleClientId, fetchGmailMessages, fetchCalendarEvents, fetchGoogleTasks]);

  const classifiedEmails = useMemo(() => {
    return emails.map((e) => ({ ...e, bundle: classifyEmail(e, rules, bundleMap) }));
  }, [emails, rules, bundleMap]);

  const visibleEmails = useMemo(() => {
    return classifiedEmails.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${e.senderName} ${e.senderEmail} ${e.subject} ${e.snippet} ${e.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (activeNav === 'inbox') return e.status === 'inbox';
      if (activeNav === 'pinned') return e.status === 'inbox' && e.pinned;
      if (activeNav === 'snoozed') return e.status === 'snoozed';
      if (activeNav === 'done') return e.status === 'done';
      if (activeNav.startsWith('bundle:')) {
        const bName = activeNav.replace('bundle:', '');
        return e.status === 'inbox' && e.bundle === bName;
      }
      return true;
    });
  }, [classifiedEmails, activeNav, searchQuery]);

  const modifyGmailLabels = async (gmailId, addLabelIds = [], removeLabelIds = []) => {
    if (!accessToken || !gmailId) return;
    try {
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/modify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      });
    } catch {}
  };

  const togglePin = (id, ev) => {
    ev?.stopPropagation();
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e)));
  };

  const markDone = (id, ev) => {
    ev?.stopPropagation();
    const target = emails.find((e) => e.id === id);
    if (target?.gmailId) modifyGmailLabels(target.gmailId, [], ['INBOX']);
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'done', pinned: false, completedAt: Date.now() } : e)));
    if (openEmailId === id) setOpenEmailId(null);
    showToast('Archived in Gmail (Done)');
  };

  const sweepBucket = (bucket) => {
    const now = Date.now();
    setEmails((prev) =>
      prev.map((e) => {
        if (e.status === 'inbox' && e.bucket === bucket && !e.pinned) {
          if (e.gmailId) modifyGmailLabels(e.gmailId, [], ['INBOX']);
          return { ...e, status: 'done', completedAt: now };
        }
        return e;
      })
    );
    showToast(`Swept unpinned items in ${bucket}`);
  };

  const sweepBundle = (bucket, bundleName, ev) => {
    ev?.stopPropagation();
    const now = Date.now();
    setEmails((prev) =>
      prev.map((e) => {
        const b = classifyEmail(e, rules, bundleMap);
        if (e.status === 'inbox' && e.bucket === bucket && b === bundleName && !e.pinned) {
          if (e.gmailId) modifyGmailLabels(e.gmailId, [], ['INBOX']);
          return { ...e, status: 'done', completedAt: now };
        }
        return e;
      })
    );
    showToast(`Swept ${bundleName} in ${bucket}`);
  };

  const moveBundleOrder = (index, direction) => {
    const updated = [...bundles];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setBundles(updated);
  };

  const cardSurface = darkMode ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900';
  const rowHover = darkMode ? 'hover:bg-gray-800/80 border-gray-800' : 'hover:bg-gray-50 border-gray-100';

  const renderEmailRow = (email, nested = false) => {
    const meta = bundleMap[email.bundle] || bundleMap.Primary;
    return (
      <div
        key={email.id}
        onClick={() => setOpenEmailId(email.id)}
        className={`group flex items-center gap-3 px-4 py-3 ${darkMode ? 'bg-gray-900' : 'bg-white'} ${rowHover} border-b border-gray-100 dark:border-gray-800 cursor-pointer ${nested ? 'pl-8 bg-slate-50/50 dark:bg-gray-950/50' : ''}`}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0" style={{ backgroundColor: meta.color }}>
          {(email.senderName || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${email.unread ? 'font-bold' : 'font-medium'}`}>{email.senderName}</span>
            <span className="text-xs text-gray-400 shrink-0">{email.timeLabel}</span>
          </div>
          <div className="text-sm truncate">
            <span className={email.unread ? 'font-semibold' : ''}>{email.subject}</span>
            <span className="text-gray-400"> — {email.snippet}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={(ev) => togglePin(email.id, ev)} className={`p-1.5 rounded ${email.pinned ? 'text-blue-500' : 'text-gray-400'}`}><Pin className="w-4 h-4" /></button>
          <button onClick={(ev) => markDone(email.id, ev)} className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10"><Check className="w-4 h-4" /></button>
        </div>
      </div>
    );
  };

  const buckets = ['Today', 'Yesterday', 'Earlier this month'];
  const openEmail = classifiedEmails.find((e) => e.id === openEmailId);

  return (
    <div className={`h-full flex flex-col overflow-hidden ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-[#f2f2f2] text-gray-900'}`}>
      <header className={`bg-[#4285F4] text-white shadow-md px-4 h-14 flex items-center justify-between gap-3 shrink-0 z-30`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen((v) => !v)} className="p-2 rounded-full hover:bg-white/15">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-lg tracking-tight">Abstract Inbox</span>
        </div>

        <div className="flex-1 max-w-xl">
          <div className="relative flex items-center bg-white/20 rounded-md px-3 py-1.5">
            <Search className="w-4 h-4 mr-2 opacity-80" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail & tasks..."
              className="w-full bg-transparent text-sm placeholder-white/80 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setDarkMode((d) => !d)} className="p-2 rounded-full bg-white/15 hover:bg-white/25">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => setConnectModalOpen(true)} className="flex items-center gap-1 bg-white/15 px-3 py-1.5 rounded-full text-xs font-medium">
            <KeyRound className="w-3.5 h-3.5" />
            <span>{accessToken ? 'Connected' : 'Connect'}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && (
          <aside className={`w-60 border-r flex flex-col justify-between py-3 shrink-0 z-20 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="overflow-y-auto px-2 space-y-1">
              {[
                { id: 'inbox', label: 'Inbox', icon: InboxIcon, color: 'text-blue-500' },
                { id: 'pinned', label: 'Pinned', icon: Pin, color: 'text-amber-500' },
                { id: 'snoozed', label: 'Snoozed', icon: Clock, color: 'text-amber-500' },
                { id: 'done', label: 'Done (Archived)', icon: CheckCheck, color: 'text-emerald-500' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveNav(item.id); setOpenEmailId(null); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${activeNav === item.id ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-gray-500/10'}`}
                  >
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <div className="pt-3 pb-1 px-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <span>Bundles</span>
                <button onClick={() => setRuleModalOpen(true)}><FolderPlus className="w-3.5 h-3.5" /></button>
              </div>

              {bundles.filter((b) => b.id !== 'Primary').map((b, idx) => {
                const active = activeNav === `bundle:${b.id}`;
                return (
                  <div key={b.id} className="flex items-center justify-between group px-2 py-1 rounded hover:bg-gray-500/10">
                    <button
                      onClick={() => { setActiveNav(`bundle:${b.id}`); setOpenEmailId(null); }}
                      className={`flex items-center gap-2 text-sm truncate flex-1 ${active ? 'font-bold text-blue-400' : ''}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="truncate">{b.label}</span>
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      <button onClick={() => moveBundleOrder(idx, 'up')} className="p-1 hover:text-blue-500"><ArrowUp className="w-3 h-3" /></button>
                      <button onClick={() => moveBundleOrder(idx, 'down')} className="p-1 hover:text-blue-500"><ArrowDown className="w-3 h-3" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto pb-20">
            {openEmail ? (
              <div className={`rounded-lg border shadow-sm p-6 ${cardSurface}`}>
                <button onClick={() => setOpenEmailId(null)} className="flex items-center gap-1.5 text-sm mb-4 font-medium opacity-80 hover:opacity-100">
                  <ArrowLeft className="w-4 h-4" /> Back to Inbox
                </button>
                <h2 className="text-xl font-semibold mb-2">{openEmail.subject}</h2>
                <div className="text-xs text-gray-500 mb-4 pb-2 border-b">{openEmail.senderName} &lt;{openEmail.senderEmail}&gt;</div>
                <div className="text-sm whitespace-pre-line">{openEmail.body || openEmail.snippet}</div>
              </div>
            ) : activeNav === 'inbox' ? (
              buckets.map((bucket) => {
                const bucketItems = visibleEmails.filter((e) => e.bucket === bucket);
                if (bucketItems.length === 0) return null;

                const directItems = bucketItems.filter((e) => !bundleMap[e.bundle]?.inlineBundle);
                const bundledGroups = {};
                bucketItems.filter((e) => bundleMap[e.bundle]?.inlineBundle).forEach((e) => {
                  if (!bundledGroups[e.bundle]) bundledGroups[e.bundle] = [];
                  bundledGroups[e.bundle].push(e);
                });

                return (
                  <section key={bucket} className="mb-6">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{bucket}</h3>
                      <button onClick={() => sweepBucket(bucket)} className="text-xs text-gray-400 hover:text-emerald-500 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" /> Sweep unpinned
                      </button>
                    </div>
                    <div className={`rounded-lg shadow-sm border overflow-hidden ${cardSurface}`}>
                      {directItems.map((email) => renderEmailRow(email, false))}
                      {Object.entries(bundledGroups).map(([bundleName, items]) => {
                        const meta = bundleMap[bundleName];
                        if (!meta) return null;
                        const expandKey = `${bucket}-${bundleName}`;
                        const isExpanded = !!expandedBundles[expandKey];
                        const Icon = ICON_MAP[meta.iconName] || Bell;

                        return (
                          <div key={expandKey} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                            <div
                              onClick={() => setExpandedBundles((prev) => ({ ...prev, [expandKey]: !prev[expandKey] }))}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${rowHover}`}
                            >
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: meta.color }}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm" style={{ color: meta.color }}>{meta.label} ({items.length})</span>
                                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                </div>
                              </div>
                              <button onClick={(ev) => sweepBundle(bucket, bundleName, ev)} className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10" title={`Sweep ${meta.label}`}>
                                <CheckCheck className="w-4 h-4" />
                              </button>
                            </div>
                            {isExpanded && items.map((item) => renderEmailRow(item, true))}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            ) : (
              <div className={`rounded-lg shadow-sm border overflow-hidden ${cardSurface}`}>
                {visibleEmails.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">No items found here.</div>
                ) : (
                  visibleEmails.map((email) => renderEmailRow(email, false))
                )}
              </div>
            )}
          </div>
        </main>

        {/* Gmail-Style Far Right Icon Strip & Flyout Panel */}
        <div className="flex shrink-0 z-20">
          {/* Slide-out Panel */}
          {activeRightPanel && (
            <aside className={`w-80 border-l flex flex-col ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="p-3 border-b flex items-center justify-between text-xs font-semibold">
                <span>{activeRightPanel === 'tasks' ? 'Google Tasks' : 'Google Calendar'}</span>
                <button onClick={() => setActiveRightPanel(null)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="p-3 space-y-4 flex-1 overflow-y-auto">
                {activeRightPanel === 'tasks' ? (
                  <div>
                    <div className="flex gap-1 mb-3">
                      <input
                        type="text"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (addGoogleTask(newTaskText), setNewTaskText(''))}
                        placeholder="Add a task..."
                        className="flex-1 text-xs border rounded px-2.5 py-2 bg-transparent"
                      />
                      <button onClick={() => (addGoogleTask(newTaskText), setNewTaskText(''))} className="bg-blue-600 text-white px-3 py-2 rounded text-xs font-medium">Add</button>
                    </div>
                    {!accessToken ? (
                      <div className="text-xs text-gray-400 text-center py-6">Connect Google to sync tasks.</div>
                    ) : tasks.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-6">No tasks found.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {tasks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded bg-gray-500/5 border border-gray-100 dark:border-gray-800">
                            <span className={t.done ? 'line-through text-gray-400' : ''}>{t.text}</span>
                            <div className="flex gap-1">
                              <button onClick={() => toggleGoogleTask(t)} className="text-emerald-500 p-1"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteGoogleTask(t)} className="text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {!accessToken ? (
                      <div className="text-xs text-gray-400 text-center py-6">Connect Google to sync calendar.</div>
                    ) : calendarError ? (
                      <div className="text-xs text-amber-500 text-center py-6">Calendar access required. Reconnect Google.</div>
                    ) : calendarEvents.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-6">No upcoming events.</div>
                    ) : (
                      <div className="space-y-2">
                        {calendarEvents.map((ev) => (
                          <div key={ev.id} className="p-2.5 rounded bg-indigo-500/5 border-l-4 border-indigo-500 text-xs">
                            <div className="font-semibold">{ev.summary}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleString() : 'All day'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Slim Icon Strip */}
          <div className={`w-14 border-l flex flex-col items-center py-3 gap-4 shrink-0 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <button
              onClick={() => setActiveRightPanel(activeRightPanel === 'calendar' ? null : 'calendar')}
              title="Google Calendar"
              className={`p-2.5 rounded-full transition-colors ${activeRightPanel === 'calendar' ? 'bg-blue-500/20 text-blue-500' : 'text-gray-500 hover:bg-gray-500/10'}`}
            >
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </button>
            <button
              onClick={() => setActiveRightPanel(activeRightPanel === 'tasks' ? null : 'tasks')}
              title="Google Tasks"
              className={`p-2.5 rounded-full transition-colors ${activeRightPanel === 'tasks' ? 'bg-blue-500/20 text-blue-500' : 'text-gray-500 hover:bg-gray-500/10'}`}
            >
              <ListTodo className="w-5 h-5 text-blue-600" />
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
