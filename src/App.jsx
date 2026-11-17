import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Menu,
  Search,
  Pin,
  Clock,
  Check,
  CheckCheck,
  Inbox as InboxIcon,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
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
  Moon,
  Sun,
  Calendar as CalendarIcon,
  ListTodo,
  ExternalLink,
  MoreVertical,
  CheckSquare,
  Lightbulb,
  User,
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
  BellRing: Bell,
};

const DEFAULT_BUNDLES = [
  { id: 'Primary', label: 'Primary', color: '#4285F4', iconName: 'Mail', inlineBundle: false },
  { id: 'Updates', label: 'Updates', color: '#FBBC05', iconName: 'Bell', inlineBundle: true },
  { id: 'Finance', label: 'Finance & Bills', color: '#0F9D58', iconName: 'Landmark', inlineBundle: true },
  { id: 'Purchases', label: 'Purchases', color: '#8E24AA', iconName: 'ShoppingBag', inlineBundle: true },
  { id: 'Promos', label: 'Promos', color: '#00ACC1', iconName: 'Sparkles', inlineBundle: true },
  { id: 'Social', label: 'Social', color: '#DB4437', iconName: 'Users', inlineBundle: true },
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
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
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
  const [activeNav, setActiveNav] = useState('inbox');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState('tasks');

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBundles, setExpandedBundles] = useState({});
  const [openEmailId, setOpenEmailId] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);

  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('classic_inbox_client_id') || '');
  const [accessToken, setAccessToken] = useState(() => {
    const savedToken = localStorage.getItem('classic_inbox_token');
    const expiry = Number(localStorage.getItem('classic_inbox_token_expiry') || 0);
    return savedToken && Date.now() < expiry - 60000 ? savedToken : null;
  });

  useEffect(() => { localStorage.setItem('classic_inbox_bundles_v4', JSON.stringify(bundles)); }, [bundles]);
  useEffect(() => { localStorage.setItem('classic_inbox_emails_v4', JSON.stringify(emails)); }, [emails]);
  useEffect(() => { localStorage.setItem('classic_inbox_rules_v4', JSON.stringify(rules)); }, [rules]);
  useEffect(() => { localStorage.setItem('classic_inbox_dark', String(darkMode)); }, [darkMode]);

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
          setTasks(data.items.map((t) => ({ id: t.id, text: t.title, details: t.notes || '', done: t.status === 'completed', googleTaskId: t.id })));
        }
      }
    } catch {}
  }, []);

  const addGoogleTask = async (text) => {
    if (!text.trim()) return;
    const tempId = `task-${Date.now()}`;
    const newTask = { id: tempId, text: text.trim(), details: '', done: false };
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
                timeLabel,
                bucket,
                status: 'inbox',
                pinned: false,
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
            return old ? { ...f, pinned: old.pinned, status: old.status, manualBundle: old.manualBundle } : f;
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

  const triggerGoogleAuth = useCallback(() => {
    const clientIdToUse = googleClientId || localStorage.getItem('classic_inbox_client_id');
    if (!clientIdToUse?.trim()) {
      showToast('Please set your Google Client ID first');
      return;
    }
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
            fetchGmailMessages(tokenResponse.access_token);
            fetchCalendarEvents(tokenResponse.access_token);
            fetchGoogleTasks(tokenResponse.access_token);
            showToast('Connected to Google successfully!');
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
  }, [googleClientId, fetchGmailMessages, fetchCalendarEvents, fetchGoogleTasks]);

  useEffect(() => {
    if (accessToken) {
      fetchGmailMessages(accessToken);
      fetchCalendarEvents(accessToken);
      fetchGoogleTasks(accessToken);
    }
  }, [accessToken, fetchGmailMessages, fetchCalendarEvents, fetchGoogleTasks]);

  const classifiedEmails = useMemo(() => {
    return emails.map((e) => ({ ...e, bundle: classifyEmail(e, rules, bundleMap) }));
  }, [emails, rules, bundleMap]);

  const visibleEmails = useMemo(() => {
    return classifiedEmails.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${e.senderName} ${e.senderEmail} ${e.subject} ${e.snippet}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (activeNav === 'inbox') return e.status === 'inbox';
      if (activeNav === 'pinned') return e.status === 'inbox' && e.pinned;
      if (activeNav === 'done') return e.status === 'done';
      if (activeNav.startsWith('bundle:')) {
        const bName = activeNav.replace('bundle:', '');
        return e.status === 'inbox' && e.bundle === bName;
      }
      return true;
    });
  }, [classifiedEmails, activeNav, searchQuery]);

  const togglePin = (id, ev) => {
    ev?.stopPropagation();
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e)));
  };

  const markDone = (id, ev) => {
    ev?.stopPropagation();
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'done', pinned: false } : e)));
    if (openEmailId === id) setOpenEmailId(null);
    showToast('Moved to Done');
  };

  const sweepBucket = (bucket) => {
    setEmails((prev) =>
      prev.map((e) => (e.status === 'inbox' && e.bucket === bucket && !e.pinned ? { ...e, status: 'done' } : e))
    );
    showToast(`Swept unpinned items in ${bucket}`);
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
          <button onClick={() => setSidebarOpen((v) => !v)} className="p-2 rounded-full hover:bg-white/15"><Menu className="w-5 h-5" /></button>
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
          <button onClick={triggerGoogleAuth} className="flex items-center gap-1 bg-white/15 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/25">
            <KeyRound className="w-3.5 h-3.5" />
            <span>{accessToken ? 'Connected' : 'Connect Google'}</span>
          </button>
          <button onClick={() => setDarkMode((d) => !d)} className="p-2 rounded-full bg-white/15 hover:bg-white/25">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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

              <div className="pt-3 pb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Bundles</div>
              {bundles.filter((b) => b.id !== 'Primary').map((b) => {
                const active = activeNav === `bundle:${b.id}`;
                return (
                  <button
                    key={b.id}
                    onClick={() => { setActiveNav(`bundle:${b.id}`); setOpenEmailId(null); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm truncate ${active ? 'font-bold text-blue-400 bg-blue-500/10' : 'hover:bg-gray-500/10'}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <span className="truncate">{b.label}</span>
                  </button>
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

        {/* Gmail-Style Exact Right Panel & Add-on Rail */}
        <div className="flex shrink-0 z-20">
          {activeRightPanel && (
            <aside className={`w-80 border-l flex flex-col ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              {activeRightPanel === 'tasks' ? (
                <>
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">TASKS</span>
                      <div className="flex items-center gap-1 text-sm font-semibold text-gray-800 dark:text-gray-100 cursor-pointer">
                        <span>To-do</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <button title="Open in full tab" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><ExternalLink className="w-4 h-4" /></button>
                      <button onClick={() => setActiveRightPanel(null)} title="Close side panel" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto space-y-4">
                    <div className="relative flex items-center border-2 border-blue-600 rounded-full px-4 py-2.5 shadow-sm">
                      <CheckSquare className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                      <input
                        type="text"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (addGoogleTask(newTaskText), setNewTaskText(''))}
                        placeholder="Add a task"
                        className="w-full text-sm bg-transparent placeholder-blue-600/70 text-blue-900 dark:text-blue-200 focus:outline-none"
                      />
                      <button onClick={() => (addGoogleTask(newTaskText), setNewTaskText(''))} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-medium">Add</button>
                    </div>

                    <div className="space-y-3 pt-2">
                      {tasks.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-6">{accessToken ? 'No tasks found.' : 'Connect Google to sync tasks.'}</div>
                      ) : (
                        tasks.map((t) => (
                          <div key={t.id} className="flex items-start gap-3 group">
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={() => toggleGoogleTask(t)}
                              className="w-5 h-5 rounded-full border-2 border-gray-400 text-blue-600 focus:ring-0 mt-0.5 cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                {t.text}
                              </div>
                              {t.details && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                  {t.details}
                                </div>
                              )}
                            </div>
                            <button onClick={() => deleteGoogleTask(t)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : activeRightPanel === 'calendar' ? (
                <>
                  <div className="p-3 border-b flex items-center justify-between text-xs font-semibold">
                    <span>Google Calendar</span>
                    <button onClick={() => setActiveRightPanel(null)}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                  <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                    {!accessToken ? (
                      <div className="text-xs text-gray-400 text-center py-6">Connect Google to sync calendar.</div>
                    ) : calendarError ? (
                      <div className="text-xs text-amber-500 text-center py-6">Calendar access required. Reconnect Google.</div>
                    ) : calendarEvents.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-6">No upcoming events.</div>
                    ) : (
                      calendarEvents.map((ev) => (
                        <div key={ev.id} className="p-2.5 rounded bg-blue-500/5 border-l-4 border-blue-500 text-xs">
                          <div className="font-semibold">{ev.summary}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleString() : 'All day'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 flex items-center justify-between text-xs font-semibold border-b">
                  <span>{activeRightPanel.toUpperCase()} PANEL</span>
                  <button onClick={() => setActiveRightPanel(null)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
              )}
            </aside>
          )}

          <div className={`w-14 border-l flex flex-col items-center py-4 gap-6 shrink-0 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50/80 border-gray-200'}`}>
            <button
              onClick={() => setActiveRightPanel(activeRightPanel === 'calendar' ? null : 'calendar')}
              title="Google Calendar"
              className={`p-2 rounded-lg transition-colors ${activeRightPanel === 'calendar' ? 'bg-blue-500/20 text-blue-600' : 'text-gray-600 hover:bg-gray-200/60 dark:text-gray-400'}`}
            >
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </button>
            <button
              onClick={() => setActiveRightPanel(activeRightPanel === 'keep' ? null : 'keep')}
              title="Google Keep"
              className={`p-2 rounded-lg transition-colors ${activeRightPanel === 'keep' ? 'bg-yellow-500/20 text-yellow-600' : 'text-gray-600 hover:bg-gray-200/60 dark:text-gray-400'}`}
            >
              <Lightbulb className="w-5 h-5 text-amber-500" />
            </button>
            <button
              onClick={() => setActiveRightPanel(activeRightPanel === 'tasks' ? null : 'tasks')}
              title="Google Tasks"
              className={`p-2 rounded-lg transition-colors ${activeRightPanel === 'tasks' ? 'bg-blue-500/25 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200/60 dark:text-gray-400'}`}
            >
              <CheckSquare className="w-5 h-5 text-blue-600" />
            </button>
            <button
              onClick={() => setActiveRightPanel(activeRightPanel === 'contacts' ? null : 'contacts')}
              title="Google Contacts"
              className={`p-2 rounded-lg transition-colors ${activeRightPanel === 'contacts' ? 'bg-blue-500/20 text-blue-600' : 'text-gray-600 hover:bg-gray-200/60 dark:text-gray-400'}`}
            >
              <User className="w-5 h-5 text-blue-500" />
            </button>
            <div className="w-6 h-[1px] bg-gray-300 dark:bg-gray-700 my-1" />
            <button title="Get Add-ons" className="p-2 rounded-lg text-gray-600 hover:bg-gray-200/60 dark:text-gray-400">
              <Plus className="w-5 h-5" />
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
