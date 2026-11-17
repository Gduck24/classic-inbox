import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FolderPlus,
  Calendar as CalendarIcon,
  ListTodo,
  ArrowUp,
  ArrowDown,
  Tag,
  Database,
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

const SAMPLE_EMAILS = [
  {
    id: 'sample-1',
    senderName: 'Five Iron Golf',
    senderEmail: 'league@fiveirongolf.com',
    subject: 'Re: ⛳ Winter League ’26 Welcome Email!',
    snippet: 'Hey Grayson! We are looping our team at DFW to help you getting matched up...',
    body: 'Hey Grayson!\n\nWe are looping our team at DFW to help you getting matched up for the upcoming indoor TrackMan simulator league.\n\nMake sure your handicap is dialed in and your radar-compatible balls are ready to go.\n\nBest,\nFive Iron Golf Team',
    timeLabel: '12:28 PM',
    bucket: 'Today',
    status: 'inbox',
    pinned: true,
    unread: true,
  },
  {
    id: 'sample-2',
    senderName: 'CARS_socialmedia',
    senderEmail: 'updates@gm-trucks.com',
    subject: 'Re: [EXTERNAL] Help for long time Chevy Family - Gduck24 on GM-Trucks.com',
    snippet: 'Hello Grayson, To clarify, are you still looking for wiring diagrams...',
    body: 'Hello Grayson,\n\nTo clarify, are you still looking for wiring diagrams for your Z71 steering column harness replacement?\n\nLet us know if the pinouts match your previous generation notes.\n\nThanks,\nGM-Trucks Forum Team',
    timeLabel: '9:27 AM',
    bucket: 'Today',
    status: 'inbox',
    pinned: false,
    unread: true,
  },
  {
    id: 'sample-3',
    senderName: 'Kickstarter Updates',
    senderEmail: 'no-reply@kickstarter.com',
    subject: 'Project Update #12: CNC Laser Enclosure Shipping Status',
    snippet: 'Your reward package has cleared initial quality inspection...',
    body: 'Hello Backer,\n\nYour reward package for the advanced enclosure kit has cleared initial quality inspection and is queued for freight carrier pickup.\n\nTrack your shipment details inside your dashboard.',
    timeLabel: 'Yesterday',
    bucket: 'Yesterday',
    status: 'inbox',
    pinned: false,
    unread: false,
  },
  {
    id: 'sample-4',
    senderName: 'City Utility Billing',
    senderEmail: 'billing@fortworthtexas.gov',
    subject: 'Statement Ready: Monthly Utility Statement #FW-88492',
    snippet: 'Your new statement is ready for review. Balance due: $142.50...',
    body: 'Your monthly utility statement for your property in Fort Worth is now ready for review.\n\nBalance Due: $142.50\nDue Date: December 1st.\n\nLog in to your account portal to pay online.',
    timeLabel: 'Yesterday',
    bucket: 'Yesterday',
    status: 'inbox',
    pinned: false,
    unread: false,
  },
  {
    id: 'sample-5',
    senderName: 'YETI Authorized Store',
    senderEmail: 'orders@yeti.com',
    subject: 'Order Confirmation #YT-99281 - Custom Laser Engraved Tumbler',
    snippet: 'Thanks for your order! We are customizing your 30oz olive green YETI...',
    body: 'Thanks for your order, Grayson!\n\nWe are currently laser engraving your custom graphics onto your 30oz olive green YETI tumbler.\n\nWe will email tracking information as soon as it ships out.',
    timeLabel: 'Nov 7',
    bucket: 'Earlier this month',
    status: 'inbox',
    pinned: false,
    unread: false,
  },
];

const SAMPLE_TASKS = [
  { id: 't1', text: 'Pick up steel stock for driveway gate post', done: false },
  { id: 't2', text: 'Test TrackMan simulator spin rates with RCT balls', done: false },
  { id: 't3', text: 'Review Chief Architect floor plan updates', done: true },
];

const SAMPLE_CALENDAR = [
  { id: 'c1', summary: 'Commercial Construction Site Walk', start: { dateTime: '2026-11-18T09:00:00-06:00' } },
  { id: 'c2', summary: 'Indoor Simulator League Match @ Five Iron', start: { dateTime: '2026-11-18T18:30:00-06:00' } },
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
  const [bundles, setBundles] = useState(DEFAULT_BUNDLES);
  const [emails, setEmails] = useState(SAMPLE_EMAILS);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [tasks, setTasks] = useState(SAMPLE_TASKS);
  const [calendarEvents, setCalendarEvents] = useState(SAMPLE_CALENDAR);

  const [darkMode, setDarkMode] = useState(false);
  const [activeNav, setActiveNav] = useState('inbox');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState('tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBundles, setExpandedBundles] = useState({});
  const [openEmailId, setOpenEmailId] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [toast, setToast] = useState(null);
  const [isSampleMode, setIsSampleMode] = useState(true);

  const bundleMap = useMemo(() => {
    const map = {};
    bundles.forEach((b) => { map[b.id] = b; });
    return map;
  }, [bundles]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const toggleSampleMode = () => {
    if (!isSampleMode) {
      setEmails(SAMPLE_EMAILS);
      setTasks(SAMPLE_TASKS);
      setCalendarEvents(SAMPLE_CALENDAR);
      setIsSampleMode(true);
      showToast('Loaded sample sandbox workspace');
    } else {
      setEmails([]);
      setTasks([]);
      setCalendarEvents([]);
      setIsSampleMode(false);
      showToast('Cleared sandbox workspace');
    }
  };

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

  const sweepBundle = (bucket, bundleName, ev) => {
    ev?.stopPropagation();
    setEmails((prev) =>
      prev.map((e) => {
        const b = classifyEmail(e, rules, bundleMap);
        if (e.status === 'inbox' && e.bucket === bucket && b === bundleName && !e.pinned) {
          return { ...e, status: 'done' };
        }
        return e;
      })
    );
    showToast(`Swept ${bundleName} in ${bucket}`);
  };

  const addSandboxTask = (text) => {
    if (!text.trim()) return;
    setTasks((prev) => [{ id: `task-${Date.now()}`, text: text.trim(), done: false }, ...prev]);
  };

  const toggleTask = (task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
  };

  const deleteTask = (task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
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
          <button onClick={toggleSampleMode} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isSampleMode ? 'bg-emerald-600 text-white shadow' : 'bg-white/15 hover:bg-white/25'}`}>
            <Database className="w-3.5 h-3.5" />
            <span>{isSampleMode ? 'Sandbox Active' : 'Load Sandbox'}</span>
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
                              <button onClick={(ev) => sweepBundle(bucket, bundleName, ev)} className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10">
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
                        onKeyDown={(e) => e.key === 'Enter' && (addSandboxTask(newTaskText), setNewTaskText(''))}
                        placeholder="Add a task..."
                        className="flex-1 text-xs border rounded px-2.5 py-2 bg-transparent"
                      />
                      <button onClick={() => (addSandboxTask(newTaskText), setNewTaskText(''))} className="bg-blue-600 text-white px-3 py-2 rounded text-xs font-medium">Add</button>
                    </div>
                    <div className="space-y-1.5">
                      {tasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded bg-gray-500/5 border border-gray-100 dark:border-gray-800">
                          <span className={t.done ? 'line-through text-gray-400' : ''}>{t.text}</span>
                          <div className="flex gap-1">
                            <button onClick={() => toggleTask(t)} className="text-emerald-500 p-1"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteTask(t)} className="text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calendarEvents.map((ev) => (
                      <div key={ev.id} className="p-2.5 rounded bg-indigo-500/5 border-l-4 border-indigo-500 text-xs">
                        <div className="font-semibold">{ev.summary}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(ev.start.dateTime).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}

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
