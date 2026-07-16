import { useEffect, useState, useCallback, useRef } from "react";
import { ShieldCheck, Search, Send, Sparkles as SparklesIcon, Phone, Mail, MapPin, CircleHelp as HelpCircle, ChevronRight, Loader as Loader2, X, CircleAlert as AlertCircle, ClipboardList, LayoutDashboard, Lock, LogOut, User, CircleCheck as CheckCircle2, Clock, TrendingUp, Copy, Siren, Download, Sparkles, Terminal } from "lucide-react";
import { fetchTickets, fetchTicketsByUser, searchTickets, createTicketOrIncrement, updateTicketStatus } from "./api";
import type { Ticket, TicketStatus, Priority } from "./types";
import { STATUS_META, PRIORITY_META } from "./types";

const FAQS = [
  { q: "How are grievances routed?", a: "Submissions are classified by our AI router and dispatched to the responsible municipal department within minutes." },
  { q: "How long until resolution?", a: "Most standard issues are acknowledged within 24 hours and resolved within 5 business days." },
  { q: "Can I track multiple tickets?", a: "Yes. Every submission generates a tracking ID. Use the Track Your Grievances panel to monitor status." },
  { q: "What if my issue is urgent?", a: "Mark the priority field as critical. Urgent tickets are escalated immediately to on-call officers." },
];

const WARDS = [
  "Ward A (Colaba/Fort)",
  "Ward G-North (Dharavi/Dadar)",
  "Ward K-West (Andheri)",
  "Ward H-West (Bandra/Khar)",
  "Ward FN (Matunga/Sion)",
];

const SIMULATE_TITLES = [
  "Large pothole on Main Street",
  "Broken traffic signal at intersection",
  "Cracked pavement near school",
  "Contaminated water supply in sector 4",
  "Low water pressure in apartment block",
  "Drainage overflow on 5th street",
  "Street light outage on Park Avenue",
  "Voltage fluctuation damaging appliances",
  "Transformer sparking near park",
  "Overflowing garbage bins uncollected for a week",
  "Broken park bench and unsafe playground equipment",
  "Bus stop shelter damaged, no seating available",
];

type Tab = "citizen" | "admin";

const ADMIN_EMAIL = "admin@municipal.gov";
const ADMIN_PASSWORD = "admin123";
const CITIZEN_EMAIL = "citizen@gmail.com";
const CITIZEN_PASSWORD = "citizen123";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("citizen");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userTickets, setUserTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Ticket[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [confirmTicket, setConfirmTicket] = useState<Ticket | null>(null);
  const [showSOS, setShowSOS] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [authBanner, setAuthBanner] = useState(false);

  const handleTabChange = (next: Tab) => {
    setQuery("");
    setSearchResults(null);
    setError(null);
    setShowSubmitModal(false);
    setConfirmTicket(null);
    setShowSOS(false);
    setAuthBanner(false);
    setActiveTab(next);
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTickets();
      setTickets(data);
    } catch {
      setError("Unable to reach the grievance backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadUserTickets = useCallback(async (email: string) => {
    try {
      const data = await fetchTicketsByUser(email);
      setUserTickets(data);
    } catch {
      setUserTickets([]);
    }
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await searchTickets(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleReportClick = () => {
    if (!isUserLoggedIn) {
      setAuthBanner(true);
      showToast("Please sign in to your Citizen account to file an official municipal grievance.");
      return;
    }
    setAuthBanner(false);
    setShowSubmitModal(true);
  };

  const handleSubmit = async (data: { title: string; location: string }) => {
    const result = await createTicketOrIncrement({
      ...data,
      submitted_by: CITIZEN_EMAIL,
    });
    await loadTickets();
    if (isUserLoggedIn) {
      await loadUserTickets(CITIZEN_EMAIL);
    }
    setShowSubmitModal(false);
    setConfirmTicket(result.ticket);
  };

  const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
    try {
      await updateTicketStatus(ticketId, status);
      await loadTickets();
      if (isUserLoggedIn) {
        await loadUserTickets(CITIZEN_EMAIL);
      }
      showToast(`${ticketId} marked as ${STATUS_META[status].label}.`);
    } catch {
      showToast("Failed to update ticket status. Please try again.");
    }
  };

  const displayedTickets = searchResults ?? tickets;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased">
      <Header tab={activeTab} setTab={handleTabChange} />

      {activeTab === "citizen" && (
        <CitizenPortalView
          query={query}
          setQuery={(v) => { setQuery(v); runSearch(v); }}
          searching={searching}
          results={searchResults}
          error={error}
          onReportClick={handleReportClick}
          tickets={displayedTickets}
          loading={loading}
          isUserLoggedIn={isUserLoggedIn}
          onUserLogin={() => { setIsUserLoggedIn(true); setAuthBanner(false); loadUserTickets(CITIZEN_EMAIL); }}
          onUserLogout={() => { setIsUserLoggedIn(false); setUserTickets([]); }}
          userTickets={userTickets}
          onSOS={() => setShowSOS(true)}
          authBanner={authBanner}
        />
      )}

      {activeTab === "admin" && (
        isAdminLoggedIn ? (
          <AdminDashboard
            tickets={tickets}
            loading={loading}
            onLogout={() => setIsAdminLoggedIn(false)}
            showToast={showToast}
            onStatusChange={handleStatusChange}
            onSimulate={async () => {
              const title = SIMULATE_TITLES[Math.floor(Math.random() * SIMULATE_TITLES.length)];
              const ward = WARDS[Math.floor(Math.random() * WARDS.length)];
              await createTicketOrIncrement({
                title,
                location: ward,
                submitted_by: "crowd@citizen.gov",
              });
              await loadTickets();
              showToast("Live ticket simulated and routed by AI.");
            }}
          />
        ) : (
          <AdminLoginCard onSuccess={() => setIsAdminLoggedIn(true)} />
        )
      )}

      {showSubmitModal && (
        <SubmitModal onClose={() => setShowSubmitModal(false)} onSubmit={handleSubmit} />
      )}

      {confirmTicket && (
        <ConfirmationModal ticket={confirmTicket} onClose={() => setConfirmTicket(null)} showToast={showToast} />
      )}

      {showSOS && (
        <SOSModal onClose={() => setShowSOS(false)} />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────── */

function Header({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const navItems: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "citizen", label: "Citizen Portal", icon: Send },
    { id: "admin", label: "Admin Panel", icon: LayoutDashboard },
  ];
  return (
    <header className="sticky top-0 z-30 bg-[#0b1f3a] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 ring-1 ring-blue-400/40">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">Citizen Portal</p>
              <p className="text-[11px] text-blue-200/70">AI Grievance Routing</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    active ? "bg-blue-600 text-white shadow-sm" : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

/* ── Citizen Portal View ────────────────────────────────── */

function CitizenPortalView({
  query,
  setQuery,
  searching,
  results,
  error,
  onReportClick,
  tickets,
  loading,
  isUserLoggedIn,
  onUserLogin,
  onUserLogout,
  userTickets,
  onSOS,
  authBanner,
}: {
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  results: Ticket[] | null;
  error: string | null;
  onReportClick: () => void;
  tickets: Ticket[];
  loading: boolean;
  isUserLoggedIn: boolean;
  onUserLogin: () => void;
  onUserLogout: () => void;
  userTickets: Ticket[];
  onSOS: () => void;
  authBanner: boolean;
}) {
  return (
    <>
      <Hero query={query} setQuery={setQuery} searching={searching} results={results} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <ActionGrid onReportClick={onReportClick} isUserLoggedIn={isUserLoggedIn} />
            <SOSButton onClick={onSOS} />
          </div>
          <div className="lg:col-span-1">
            <TrackingPanel
              isUserLoggedIn={isUserLoggedIn}
              onUserLogin={onUserLogin}
              onUserLogout={onUserLogout}
              userTickets={userTickets}
              authBanner={authBanner}
            />
          </div>
        </div>
      </main>
      <FooterRegion tickets={tickets} loading={loading} faqs={FAQS} />
    </>
  );
}

function Hero({
  query,
  setQuery,
  searching,
  results,
}: {
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  results: Ticket[] | null;
}) {
  return (
    <section className="bg-gradient-to-b from-slate-200 to-slate-100 pt-14 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            AI-powered routing is live
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
            Welcome to the <span className="text-blue-600">Citizen Portal</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Report local issues, track their resolution, and let our AI route them to the right department — instantly.
          </p>
        </div>
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="group flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl shadow-slate-300/40 ring-1 ring-slate-200 transition-all focus-within:ring-2 focus-within:ring-blue-500">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search grievances by title, category, or location..."
              className="flex-1 bg-transparent text-base text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            {searching && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
            {query && !searching && (
              <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {results !== null && (
            <div className="mt-3 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 overflow-hidden">
              {results.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">No matching tickets found.</p>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {results.map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.title}</p>
                        <p className="text-xs text-slate-500">{t.category} · {t.location}</p>
                      </div>
                      <StatusChip status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ActionGrid({
  onReportClick,
  isUserLoggedIn,
}: {
  onReportClick: () => void;
  isUserLoggedIn: boolean;
}) {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Report an Issue</h2>
          <p className="mt-1 text-sm text-slate-500">
            Describe what's wrong — our AI reads it and routes it to the right department automatically.
          </p>
        </div>
        {!isUserLoggedIn && (
          <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            <Lock className="h-3.5 w-3.5" />
            Sign in required
          </span>
        )}
      </div>
      <button
        onClick={onReportClick}
        className={`group relative w-full overflow-hidden rounded-2xl bg-white p-8 text-left shadow-md ring-1 ring-slate-200 transition-all ${
          isUserLoggedIn
            ? "hover:-translate-y-1 hover:shadow-xl hover:ring-blue-200"
            : "opacity-75 hover:ring-amber-300"
        }`}
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 opacity-10 transition-opacity group-hover:opacity-20" />
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md">
          <SparklesIcon className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-slate-900">Tell us what happened</h3>
        <p className="mt-2 max-w-xl text-sm text-slate-500 leading-relaxed">
          Potholes, water contamination, power outages, garbage collection, damaged parks — just describe
          the issue in your own words. No need to pick a department; the AI figures that out for you.
        </p>
        <span className={`mt-5 inline-flex items-center gap-1 text-sm font-medium transition-all ${
          isUserLoggedIn ? "text-blue-600 group-hover:gap-2" : "text-slate-400"
        }`}>
          {isUserLoggedIn ? (
            <>Report now <ChevronRight className="h-4 w-4" /></>
          ) : (
            <><Lock className="h-3.5 w-3.5" /> Sign in to report</>
          )}
        </span>
      </button>
    </section>
  );
}

function SOSButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-red-600 px-6 py-4 text-white shadow-lg shadow-red-500/30 transition-all hover:bg-red-700 hover:shadow-xl"
    >
      <span className="absolute inset-0 animate-ping rounded-2xl bg-red-500/40" />
      <Siren className="h-6 w-6 relative z-10" />
      <span className="relative z-10 text-lg font-bold tracking-wide">Report Emergency</span>
    </button>
  );
}

function SOSModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-red-200">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Siren className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-900">Emergency Alert</h3>
          <p className="mt-2 text-sm text-slate-600">
            For immediate life-safety emergencies, please call the emergency services directly:
          </p>
          <div className="mt-4 flex items-center gap-4">
            <a href="tel:100" className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-red-700">
              <Phone className="h-5 w-5" />
              Call 100
            </a>
            <a href="tel:101" className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-red-700">
              <Phone className="h-5 w-5" />
              Call 101
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            This portal is for non-urgent civic grievances only. Do not rely on it for emergencies.
          </p>
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          Close
        </button>
      </div>
    </div>
  );
}

function TrackingPanel({
  isUserLoggedIn,
  onUserLogin,
  onUserLogout,
  userTickets,
  authBanner,
}: {
  isUserLoggedIn: boolean;
  onUserLogin: () => void;
  onUserLogout: () => void;
  userTickets: Ticket[];
  authBanner: boolean;
}) {
  return (
    <section className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden lg:sticky lg:top-20">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">Track Your Grievances</h3>
        </div>
        {isUserLoggedIn && (
          <button
            onClick={onUserLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        )}
      </div>
      <div className="p-5">
        {authBanner && !isUserLoggedIn && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fadeInUp">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>Please sign in to your Citizen account to file an official municipal grievance.</span>
          </div>
        )}
        {!isUserLoggedIn ? (
          <CompactCitizenLogin onSuccess={onUserLogin} />
        ) : (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              {userTickets.length === 0
                ? "You haven't filed any grievances yet."
                : `${userTickets.length} grievance${userTickets.length === 1 ? "" : "s"} on record.`}
            </p>
            {userTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <ClipboardList className="h-8 w-8 mb-2" />
                <p className="text-sm">No tickets yet. Submit one to see it here instantly.</p>
              </div>
            ) : (
              <ul className="space-y-3 max-h-[28rem] overflow-y-auto">
                {userTickets.map((t) => (
                  <li key={t.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-white transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{t.category} · {t.location}</p>
                        <p className="mt-0.5 text-xs font-mono text-blue-600">{t.ticket_id}</p>
                      </div>
                      <StatusChip status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CompactCitizenLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() === CITIZEN_EMAIL && password === CITIZEN_PASSWORD) {
      setErr(null);
      onSuccess();
    } else {
      setErr("Invalid credentials. Please check your email and password.");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <User className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Citizen Login</p>
          <p className="text-xs text-slate-500">Sign in to view your filed grievances.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="citizen@gmail.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
          />
        </div>
        {err && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Lock className="h-4 w-4" />
          Login
        </button>
      </form>
    </div>
  );
}

/* ── Status & Priority Chips ────────────────────────────── */

function StatusChip({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.chip} flex-shrink-0`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function StatusSelect({
  ticketId,
  status,
  onChange,
}: {
  ticketId: string;
  status: TicketStatus;
  onChange: (ticketId: string, status: TicketStatus) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const meta = STATUS_META[status];

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as TicketStatus;
    if (next === status) return;
    setSaving(true);
    try {
      await onChange(ticketId, next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <select
        value={status}
        onChange={handleChange}
        disabled={saving}
        className={`appearance-none cursor-pointer rounded-full pl-3.5 pr-7 py-1 text-xs font-medium ring-1 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-wait disabled:opacity-70 ${meta.chip}`}
      >
        {(Object.keys(STATUS_META) as TicketStatus[]).map((s) => (
          <option key={s} value={s}>{STATUS_META[s].label}</option>
        ))}
      </select>
      {saving ? (
        <Loader2 className="pointer-events-none absolute right-1.5 h-3 w-3 animate-spin text-slate-500" />
      ) : (
        <ChevronRight className="pointer-events-none absolute right-1.5 h-3 w-3 rotate-90 text-slate-500" />
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${meta.badge} ${meta.pulse ? "animate-pulse" : ""}`}>
      {meta.pulse && <span className="h-1.5 w-1.5 rounded-full bg-red-300 animate-ping" />}
      {meta.label}
    </span>
  );
}

/* ── Submit Modal ───────────────────────────────────────── */

function SubmitModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { title: string; location: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setTitle("");
    setLocation("");
    setErr(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !location) return;
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({ title, location });
      resetForm();
    } catch {
      setErr("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Report an Issue</h3>
            <p className="mt-1 text-sm text-slate-500">
              Describe the problem — our AI will route it to the right department.
            </p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Location / Ward</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none bg-white"
            >
              <option value="" disabled>Select a ward</option>
              {WARDS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Describe the issue</label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Large pothole near Main St that's damaging cars"
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
            />
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
              <SparklesIcon className="h-3.5 w-3.5" />
              Our AI reads this to pick the department and priority automatically.
            </p>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={submitting || !title.trim() || !location}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Submitting..." : "Submit Grievance"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Confirmation Modal ─────────────────────────────────── */

function ConfirmationModal({
  ticket,
  onClose,
  showToast,
}: {
  ticket: Ticket;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyId = () => {
    navigator.clipboard.writeText(ticket.ticket_id).then(() => {
      setCopied(true);
      showToast("Ticket ID copied to clipboard.");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-slate-200 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-slate-900">Grievance Submitted!</h3>
        <p className="mt-1 text-sm text-slate-500">
          {ticket.ai_department
            ? "Our AI read your complaint and routed it automatically."
            : "Your complaint has been logged and will be reviewed by staff."}
        </p>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Ticket ID</span>
            <span className="font-mono text-sm font-bold text-blue-600">{ticket.ticket_id}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Routed to</span>
            <span className="flex items-center gap-1.5 text-sm text-slate-700">
              <SparklesIcon className="h-3.5 w-3.5 text-blue-500" />
              {ticket.category}
              {ticket.ai_confidence != null && (
                <span className="text-xs text-slate-400">({Math.round(ticket.ai_confidence * 100)}%)</span>
              )}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Ward</span>
            <span className="text-sm text-slate-700">{ticket.location}</span>
          </div>
        </div>

        <button
          onClick={copyId}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy Ticket ID"}
        </button>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* ── Footer ─────────────────────────────────────────────── */

function FooterRegion({
  tickets,
  loading,
  faqs,
}: {
  tickets: Ticket[];
  loading: boolean;
  faqs: { q: string; a: string }[];
}) {
  return (
    <footer className="mt-20 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Frequently Asked</h3>
            </div>
            <ul className="space-y-3">
              {faqs.map((f, i) => (
                <li key={i} className="group">
                  <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-slate-800 list-none">
                      {f.q}
                      <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.a}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Phone className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Support Desk</h3>
            </div>
            <div className="space-y-4">
              <ContactRow icon={Phone} label="Helpline" value="1800-CITIZEN (24/7)" />
              <ContactRow icon={Mail} label="Email" value="support@citizenportal.gov" />
              <ContactRow icon={MapPin} label="Office" value="Municipal HQ, Block A, Ward 1" />
              <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <AlertCircle className="h-4 w-4" />
                  Emergency?
                </div>
                <p className="mt-1 text-xs text-blue-700">
                  For life-threatening situations call 100/101 directly. This portal is for non-urgent civic grievances.
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Recent Activity</h3>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                </div>
              ) : tickets.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No recent tickets.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {tickets.slice(0, 6).map((t) => (
                    <li key={t.id} className="px-4 py-3">
                      <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{t.category} · {t.location}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>© 2026 Citizen Portal — AI Grievance Routing System</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <a href="#" className="hover:text-blue-600">Privacy</a>
            <a href="#" className="hover:text-blue-600">Terms</a>
            <a href="#" className="hover:text-blue-600">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm text-slate-700">{value}</p>
      </div>
    </div>
  );
}

/* ── Admin Login ────────────────────────────────────────── */

function AdminLoginCard({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setError(null);
      onSuccess();
    } else {
      setError("Invalid credentials. Please check your email and password.");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b1f3a] text-white shadow-lg">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900">Official Admin Login</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to access the grievance routing dashboard.</p>
          </div>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@municipal.gov"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Lock className="h-4 w-4" />
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Admin Dashboard ────────────────────────────────────── */

function AdminDashboard({
  tickets,
  loading,
  onLogout,
  showToast,
  onSimulate,
  onStatusChange,
}: {
  tickets: Ticket[];
  loading: boolean;
  onLogout: () => void;
  showToast: (msg: string) => void;
  onSimulate: () => Promise<void>;
  onStatusChange: (ticketId: string, status: TicketStatus) => Promise<void>;
}) {
  const total = tickets.length;
  const pending = tickets.filter((t) => t.status === "pending").length;
  const inReview = tickets.filter((t) => t.status === "in_review").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;

  const metrics = [
    { label: "Total Tickets", value: total, icon: ClipboardList, color: "bg-blue-50 text-blue-600 ring-blue-100" },
    { label: "Pending", value: pending, icon: Clock, color: "bg-amber-50 text-amber-600 ring-amber-100" },
    { label: "In Review", value: inReview, icon: TrendingUp, color: "bg-sky-50 text-sky-600 ring-sky-100" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  ];

  const downloadCSV = () => {
    const headers = ["Ticket ID", "Category", "Location/Ward", "Complaint Text", "Report Count", "Priority", "Status"];
    const rows = tickets.map((t) => [
      t.ticket_id,
      t.category,
      t.location,
      t.title,
      t.report_count,
      t.priority,
      t.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grievance-report.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV report downloaded successfully.");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Admin Dashboard</h2>
              <p className="text-sm text-slate-500">Monitor and manage all routed grievances.</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ring-1 ${m.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">{m.value}</p>
                <p className="text-sm text-slate-500">{m.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">All Grievances</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download CSV</span>
                  </button>
                  <button
                    onClick={onSimulate}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Simulate Live Ticket</span>
                    <span className="sm:hidden">Simulate</span>
                  </button>
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              ) : total === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <ClipboardList className="h-10 w-10 mb-2" />
                  <p className="text-sm">No grievances have been submitted yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Ticket ID</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Location/Ward</th>
                        <th className="px-4 py-3 font-medium">Complaint</th>
                        <th className="px-4 py-3 font-medium text-center">Reports</th>
                        <th className="px-4 py-3 font-medium">Priority</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{t.ticket_id}</td>
                          <td className="px-4 py-3 text-slate-600">{t.category}</td>
                          <td className="px-4 py-3 text-slate-600">{t.location}</td>
                          <td className="px-4 py-3 text-slate-700 max-w-[12rem] truncate">{t.title}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                              {t.report_count}
                            </span>
                          </td>
                          <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                          <td className="px-4 py-3">
                            <StatusSelect
                              ticketId={t.ticket_id}
                              status={t.status}
                              onChange={onStatusChange}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-1">
            <NLPLogFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── NLP Log Feed ───────────────────────────────────────── */

const NLP_LOG_TEMPLATES = [
  "[Parsing Intent...]",
  "[Tokenizing complaint text...]",
  "[Model Match: Water Dept - 94% Confidence]",
  "[Model Match: Road Maintenance - 87% Confidence]",
  "[Model Match: Power Grid Ops - 91% Confidence]",
  "[Entity Extraction: Location=Ward K-West]",
  "[Sentiment Analysis: Frustration detected]",
  "[Routing to department queue...]",
  "[Priority Assessment: Crowdsourced peak]",
  "[Ticket GRIEV-2026-{num} dispatched]",
  "[NLP pipeline complete in 0.3s]",
  "[De-duplication check: match found, incrementing]",
];

function NLPLogFeed() {
  const [logs, setLogs] = useState<string[]>([
    "[System initialized — NLP router online]",
    "[Awaiting incoming grievances...]",
    "[Model Match: Water Dept - 94% Confidence]",
    "[Routing to department queue...]",
    "[NLP pipeline complete in 0.3s]",
    "[Entity Extraction: Location=Ward K-West]",
    "[Sentiment Analysis: Frustration detected]",
    "[Ticket GRIEV-2026-409 dispatched]",
    "[De-duplication check: match found, incrementing]",
    "[Model Match: Road Maintenance - 87% Confidence]",
    "[Priority Assessment: Crowdsourced peak]",
    "[Tokenizing complaint text...]",
  ]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const template = NLP_LOG_TEMPLATES[Math.floor(Math.random() * NLP_LOG_TEMPLATES.length)];
      const msg = template.replace("{num}", String(Math.floor(100 + Math.random() * 900)));
      setLogs((prev) => [...prev.slice(-30), msg]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-2xl bg-[#0b1f3a] shadow-sm ring-1 ring-slate-700 overflow-hidden lg:sticky lg:top-20">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
        <Terminal className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">System NLP Logs</h3>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-80 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-emerald-300/80 space-y-1"
      >
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="text-emerald-500/50">{String(i + 1).padStart(3, "0")}</span>
            <span>{log}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 text-emerald-400">
          <span className="animate-pulse">▊</span>
        </div>
      </div>
    </div>
  );
}

/* ── Toast ──────────────────────────────────────────────── */

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fadeInUp">
      <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-2xl ring-1 ring-slate-700">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        <span>{message}</span>
      </div>
    </div>
  );
}
