import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, AlertCircle, ArrowDownUp, ArrowRight, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronDown, Clock3, Command, GraduationCap, LayoutDashboard,
  ListChecks, LoaderCircle, LogOut, Plus, Search, Settings2, ShieldAlert, Sparkles,
  Target, Trash2, X
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import type { Assignment, Student, StudySession } from "./types";
import AuthPage from "./AuthPage";

type Page = "Overview" | "Assignments" | "Study sessions" | "Analytics" | "Profile";
type Dashboard = {
  statusCounts: { _id: string; count: number }[];
  riskCounts: { _id: string; count: number }[];
  subjects: { _id: string; count: number; estimatedHours: number; averageCompletion: number }[];
  urgent: Assignment[];
  totals: { _id: null; total: number; averageCompletion: number }[];
  overdue: number;
};
type StudyAnalytics = { weekly: { week: string; minutes: number; hours: number; sessions: number }[]; byAssignment: { title: string; subject: string; minutes: number }[]; totalMinutes: number };
const pages: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Assignments", icon: BookOpen },
  { label: "Study sessions", icon: Clock3 },
  { label: "Analytics", icon: Activity },
  { label: "Profile", icon: Settings2 }
];
const colors = ["#5c6be8", "#8e9af4", "#34b9ba", "#f1ae58", "#eb7272", "#a68ae5", "#5698c7", "#83c09b"];
const emptyAssignment = { title: "", subject: "", description: "", dueDate: "", difficulty: "Medium", estimatedHours: "3", completionPercentage: "0", checklist: [] as { text: string; completed: boolean }[] };
function datetimeLocal(value: Date | string = new Date()) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
const emptySession = { assignmentId: "", sessionDate: datetimeLocal(), durationMinutes: "45", notes: "" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
    const error = new Error(body.error ?? "Request failed.") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim() : `${minutes}m`;
}
function dueLabel(value: string) {
  const due = new Date(value);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const count = Math.ceil((day - base) / 86400000);
  if (due.getTime() < now.getTime()) return count < 0 ? `${Math.abs(count)}d overdue` : "Due time passed";
  if (count === 0) return "Due today";
  if (count === 1) return "Due tomorrow";
  return `In ${count} days`;
}

function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [study, setStudy] = useState<StudyAnalytics | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [sort, setSort] = useState("dueDate");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [viewing, setViewing] = useState<Assignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState(emptySession);
  const [profileBusy, setProfileBusy] = useState(false);
  const [reportSubject, setReportSubject] = useState("");
  const [reportRows, setReportRows] = useState<(Assignment & { studyMinutes: number })[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const studentData = await api<Student>("/auth/me");
      const [all, sessionsData, dashboardData, studyData] = await Promise.all([
        api<Assignment[]>("/assignments"),
        api<StudySession[]>("/study-sessions"),
        api<Dashboard>("/analytics/dashboard"),
        api<StudyAnalytics>("/analytics/study-time")
      ]);
      setAssignments(all);
      setSessions(sessionsData);
      setDashboard(dashboardData);
      setStudy(studyData);
      setStudent(studentData);
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        setAuthenticated(false);
        setStudent(null);
        setAssignments([]);
        setSessions([]);
        setDashboard(null);
        setStudy(null);
        setReportRows([]);
        setPage("Overview");
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to load your data.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Student>("/auth/me")
      .then((data) => {
        if (active) {
          setStudent(data);
          setAuthenticated(true);
        }
      })
      .catch((err) => {
        if (active && !(err instanceof Error && "status" in err && err.status === 401)) {
          setError(err instanceof Error ? err.message : "Unable to connect to Deadline Radar.");
        }
      })
      .finally(() => { if (active) setAuthChecking(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (authenticated) void refresh(); }, [authenticated, refresh]);
  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [authenticated, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (page !== "Analytics") return;
    const path = reportSubject ? `/analytics/subjects?subject=${encodeURIComponent(reportSubject)}` : "/analytics/subjects";
    void api<(Assignment & { studyMinutes: number })[]>(path).then(setReportRows).catch((err: Error) => setError(err.message));
  }, [dashboard, page, reportSubject]);

  const visibleAssignments = useMemo(() => assignments.filter((item) => {
    const textMatch = `${item.title} ${item.subject}`.toLowerCase().includes(query.toLowerCase());
    const dueTime = new Date(item.dueDate).getTime();
    const inOverdue = item.status !== "Completed" && dueTime < Date.now();
    const inUpcoming = item.status !== "Completed" && dueTime >= Date.now() && dueTime <= Date.now() + 7 * 86400000;
    return textMatch && (!statusFilter || item.status === statusFilter) && (!riskFilter || item.riskLevel === riskFilter) &&
      (!subjectFilter || item.subject === subjectFilter) && (!difficultyFilter || item.difficulty === difficultyFilter) &&
      (!timeFilter || (timeFilter === "overdue" ? inOverdue : inUpcoming));
  }).sort((a, b) => sort === "risk" ? b.riskScore - a.riskScore : sort === "progress" ? b.completionPercentage - a.completionPercentage : new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [assignments, difficultyFilter, query, riskFilter, sort, statusFilter, subjectFilter, timeFilter]);
  const subjectOptions = [...new Set(assignments.map((item) => item.subject))].sort();

  function openAssignment(item?: Assignment) {
    setEditing(item ?? null);
    setAssignmentForm(item ? {
      title: item.title, subject: item.subject, description: item.description ?? "",
      dueDate: datetimeLocal(item.dueDate),
      difficulty: item.difficulty, estimatedHours: String(item.estimatedHours),
      completionPercentage: String(item.completionPercentage),
      checklist: item.checklist.map(({ text, completed }) => ({ text, completed }))
    } : { ...emptyAssignment });
    setAssignmentOpen(true);
  }
  async function viewAssignment(item: Assignment) {
    setViewing(item);
    try {
      setViewing(await api<Assignment>(`/assignments/${item._id}`));
    } catch (err) {
      setViewing(null);
      setError(err instanceof Error ? err.message : "Unable to load assignment details.");
    }
  }
  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api(`/assignments${editing ? `/${editing._id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({ ...assignmentForm, estimatedHours: Number(assignmentForm.estimatedHours), completionPercentage: Number(assignmentForm.completionPercentage) })
      });
      setAssignmentOpen(false);
      setToast(editing ? "Assignment updated" : "Assignment added");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save assignment."); }
  }
  async function deleteAssignment(item: Assignment) {
    if (!window.confirm(`Delete “${item.title}”? Its linked study sessions will also be deleted.`)) return;
    try {
      await api(`/assignments/${item._id}`, { method: "DELETE" });
      setToast("Assignment and linked sessions deleted");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete assignment."); }
  }
  async function toggleChecklist(item: Assignment, id: string) {
    try {
      const checklist = item.checklist.map((entry) => ({ _id: entry._id, text: entry.text, completed: entry._id === id ? !entry.completed : entry.completed }));
      await api(`/assignments/${item._id}`, { method: "PUT", body: JSON.stringify({ title: item.title, subject: item.subject, description: item.description, dueDate: item.dueDate, difficulty: item.difficulty, estimatedHours: item.estimatedHours, completionPercentage: item.completionPercentage, checklist, tags: item.tags }) });
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update checklist."); }
  }
  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api("/study-sessions", { method: "POST", body: JSON.stringify({ ...sessionForm, durationMinutes: Number(sessionForm.durationMinutes) }) });
      setSessionOpen(false);
      setSessionForm({ ...emptySession, sessionDate: datetimeLocal() });
      setToast("Study session saved");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save study session."); }
  }
  async function deleteSession(item: StudySession) {
    if (!window.confirm("Delete this study session?")) return;
    try {
      await api(`/study-sessions/${item._id}`, { method: "DELETE" });
      setToast("Study session deleted");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete session."); }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student) return;
    setProfileBusy(true);
    try {
      const updated = await api<Student>("/students/me", { method: "PUT", body: JSON.stringify({ name: student.name, email: student.email, department: student.department, semester: student.semester }) });
      setStudent(updated);
      setToast("Profile saved");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save profile."); }
    finally { setProfileBusy(false); }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setStudent(null);
      setAssignments([]);
      setSessions([]);
      setDashboard(null);
      setStudy(null);
      setReportRows([]);
      setPage("Overview");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log out.");
    }
  }
  async function acceptLogin(data: Student) {
    setAssignments([]);
    setSessions([]);
    setDashboard(null);
    setStudy(null);
    setReportRows([]);
    setLoading(true);
    setPage("Overview");
    setStudent(data);
    setAuthenticated(true);
    setError("");
  }

  const total = dashboard?.totals?.[0]?.total ?? assignments.length;
  const completed = dashboard?.statusCounts.find((row) => row._id === "Completed")?.count ?? 0;
  const pending = Math.max(0, total - completed);
  const highRisk = dashboard?.riskCounts.find((row) => row._id === "High")?.count ?? 0;
  const average = Math.round(dashboard?.totals?.[0]?.averageCompletion ?? 0);
  const studyMinutes = study?.totalMinutes ?? 0;
  const riskChart = ["Low", "Medium", "High", "Completed"].map((level) => ({
    name: level, value: dashboard?.riskCounts.find((row) => row._id === level)?.count ?? 0
  })).filter((row) => row.value > 0);

  if (authChecking) return <div className="auth-loading"><LoaderCircle className="spin" size={23} />Checking your account…</div>;
  if (!authenticated) return <AuthPage onAuthenticated={(data) => void acceptLogin(data)} initialError={error} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("Overview"); }}>
        <span className="brand-mark"><Command size={21} strokeWidth={2.4} /></span>
        <span>deadline<span className="brand-light">radar</span><small>STUDENT WORKSPACE</small></span>
      </a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">
        {pages.map(({ label, icon: Icon }) => <button className={`nav-link ${page === label ? "active" : ""}`} key={label} onClick={() => setPage(label)}>
          <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{label === "Assignments" && pending > 0 && <b>{pending}</b>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="semester-card"><div className="semester-icon"><GraduationCap size={17} /></div><div><strong>{student?.department?.split(" ")[0] ?? "Your"} semester</strong><span>{student ? `Semester ${student.semester}` : "Academic workspace"}</span></div></div>
        <div className="student-mini"><div className="avatar">{student?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "DR"}</div><div className="student-mini-copy"><strong>{student?.name ?? "Student"}</strong><span>Personal account</span></div><ChevronDown size={15} /></div>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
        <div className="topbar-actions"><span className="date-display"><CalendarDays size={15} />{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span><button className="avatar top-avatar" title="Profile" onClick={() => setPage("Profile")}>{student?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "DR"}</button></div>
      </header>
      <main className="content">
        {error && <div className="error-banner"><AlertCircle size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
        {loading && !dashboard ? <div className="loading-state"><LoaderCircle className="spin" size={23} />Connecting to your MongoDB workspace…</div> : !loading && !dashboard && error ?
          <div className="connection-state"><span className="connection-icon"><ShieldAlert size={25} /></span><h2>Couldn’t connect to your workspace</h2><p>Check that MongoDB is running and your server has a valid <code>MONGODB_URI</code> in its environment file.</p><button className="button primary" onClick={() => void refresh()}>Try again</button></div> :
          <>
            {page === "Overview" && <section>
              <div className="page-heading"><div><div className="eyebrow"><Sparkles size={14} /> YOUR ACADEMIC PULSE</div><h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {student?.name?.split(" ")[0] ?? "there"}<span className="heading-period">.</span></h1><p>Here’s what your workload looks like right now.</p></div><button className="button primary" onClick={() => openAssignment()}><Plus size={17} /> New assignment</button></div>
              <div className="stat-grid">
                <StatCard icon={BookOpen} label="Total assignments" value={total} detail={`${completed} completed`} tone="blue" />
                <StatCard icon={Target} label="Average progress" value={`${average}%`} detail={`${pending} still in progress`} tone="teal" progress={average} />
                <StatCard icon={ShieldAlert} label="High risk" value={highRisk} detail={dashboard?.overdue ? `${dashboard.overdue} currently overdue` : "Nothing overdue"} tone="rose" />
                <StatCard icon={Clock3} label="Study time" value={durationLabel(studyMinutes)} detail={`${sessions.length} sessions recorded`} tone="violet" />
              </div>
              <div className="dashboard-grid">
                <section className="panel risk-panel">
                  <div className="panel-heading"><div><h2>Assignment risk</h2><p>Risk distribution across your workload</p></div><span className="live-tag"><i /> LIVE DATA</span></div>
                  {riskChart.length ? <div className="risk-chart-wrap"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskChart} dataKey="value" nameKey="name" innerRadius={58} outerRadius={78} paddingAngle={4} stroke="none">{riskChart.map((entry) => <Cell key={entry.name} fill={entry.name === "High" ? "#e77474" : entry.name === "Medium" ? "#f0b35c" : entry.name === "Completed" ? "#aab3c5" : "#48b9a0"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{total}</strong><span>ASSIGNMENTS</span></div></div><div className="legend">{["Low", "Medium", "High", "Completed"].map((level) => <div className="legend-row" key={level}><span className={`legend-dot ${level.toLowerCase()}`} /><span>{level} risk</span><strong>{dashboard?.riskCounts.find((row) => row._id === level)?.count ?? 0}</strong></div>)}</div></div> : <EmptyChart text="Add an assignment to see your risk breakdown." />}
                </section>
                <section className="panel workload-panel">
                  <div className="panel-heading"><div><h2>Subject workload</h2><p>Estimated effort by subject</p></div><button className="icon-button" onClick={() => setPage("Analytics")} aria-label="See analytics"><ArrowRight size={17} /></button></div>
                  {dashboard?.subjects.length ? <div className="workload-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.subjects.slice(0, 6)} layout="vertical" margin={{ left: 4, right: 16, top: 2, bottom: 2 }}><CartesianGrid horizontal={false} stroke="#edf0f6" /><XAxis type="number" hide /><YAxis type="category" dataKey="_id" width={112} tick={{ fill: "#737f98", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value} hours`, "Estimated effort"]} cursor={{ fill: "#f5f6fc" }} /><Bar dataKey="estimatedHours" radius={[0, 5, 5, 0]} barSize={13}>{dashboard.subjects.slice(0, 6).map((row, i) => <Cell key={row._id} fill={colors[i % colors.length]} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyChart text="Workload appears here once you add assignments." />}
                </section>
              </div>
              <section className="panel urgent-panel">
                <div className="panel-heading"><div><h2>Needs your attention</h2><p>Your five most urgent active assignments</p></div><button className="text-button" onClick={() => setPage("Assignments")}>All assignments <ArrowRight size={15} /></button></div>
                {dashboard?.urgent.length ? <div className="urgent-list">{dashboard.urgent.map((item) => <AssignmentRow key={item._id} item={item} onView={() => void viewAssignment(item)} onEdit={() => openAssignment(item)} onDelete={() => void deleteAssignment(item)} onToggle={(id) => void toggleChecklist(item, id)} compact />)}</div> : <div className="empty-inline"><CheckCircle2 size={21} /><span>Nothing urgent. Your future self says thanks.</span><button onClick={() => openAssignment()}>Add an assignment</button></div>}
              </section>
            </section>}
            {page === "Assignments" && <section>
              <div className="page-heading"><div><div className="eyebrow"><BookOpen size={14} /> PLAN WITH CLARITY</div><h1>Your assignments<span className="heading-period">.</span></h1><p>Keep each task moving, one small step at a time.</p></div><button className="button primary" onClick={() => openAssignment()}><Plus size={17} /> Add assignment</button></div>
              <div className="filters panel"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assignments or subjects…" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option>Pending</option><option>In Progress</option><option>Completed</option></select><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} aria-label="Filter by risk"><option value="">All risks</option><option>High</option><option>Medium</option><option>Low</option><option>Completed</option></select><select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} aria-label="Filter by subject"><option value="">All subjects</option>{subjectOptions.map((subject) => <option key={subject}>{subject}</option>)}</select><select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} aria-label="Filter by difficulty"><option value="">All difficulty</option><option>Easy</option><option>Medium</option><option>Hard</option></select><select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} aria-label="Filter by date"><option value="">Any due date</option><option value="overdue">Overdue</option><option value="upcoming">Next 7 days</option></select><button className="sort-button" onClick={() => setSort((current) => current === "dueDate" ? "risk" : current === "risk" ? "progress" : "dueDate")}><ArrowDownUp size={15} /> Sort: {sort === "dueDate" ? "Due date" : sort === "risk" ? "Risk" : "Progress"}</button></div>
              <div className="list-summary"><span>{visibleAssignments.length} assignment{visibleAssignments.length === 1 ? "" : "s"}</span><span><span className="summary-dot high" /> {highRisk} high risk</span></div>
              <div className="assignment-stack">{visibleAssignments.map((item) => <AssignmentRow key={item._id} item={item} onView={() => void viewAssignment(item)} onEdit={() => openAssignment(item)} onDelete={() => void deleteAssignment(item)} onToggle={(id) => void toggleChecklist(item, id)} />)}</div>
              {!visibleAssignments.length && <div className="empty-panel panel"><div className="empty-icon"><ListChecks size={25} /></div><h2>No assignments match</h2><p>Try changing your filters, or make a fresh start by adding an assignment.</p><button className="button primary" onClick={() => openAssignment()}><Plus size={16} /> Add assignment</button></div>}
            </section>}
            {page === "Study sessions" && <section>
              <div className="page-heading"><div><div className="eyebrow"><Clock3 size={14} /> SHOW UP, THEN SHOW PROGRESS</div><h1>Study sessions<span className="heading-period">.</span></h1><p>Time spent is worth tracking. Progress stays in your hands.</p></div><button className="button primary" onClick={() => { setSessionForm({ ...emptySession, sessionDate: datetimeLocal(), assignmentId: assignments[0]?._id ?? "" }); setSessionOpen(true); }}><Plus size={17} /> Log a session</button></div>
              <div className="stat-grid session-stats"><StatCard icon={Clock3} label="Total focus time" value={durationLabel(studyMinutes)} detail="Across all recorded sessions" tone="violet" /><StatCard icon={Activity} label="Sessions logged" value={sessions.length} detail="Your effort, counted" tone="blue" /><StatCard icon={BookOpen} label="Assignments studied" value={study?.byAssignment.length ?? 0} detail="With recorded study time" tone="teal" /><StatCard icon={Target} label="This week" value={durationLabel(study?.weekly[study.weekly.length - 1]?.minutes ?? 0)} detail="Recent weekly total" tone="rose" /></div>
              <div className="panel weekly-panel"><div className="panel-heading"><div><h2>Weekly study rhythm</h2><p>Minutes studied by week</p></div><span className="chart-unit">HOURS / WEEK</span></div>{study?.weekly.length ? <div className="weekly-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={study.weekly} margin={{ left: -16, right: 10, top: 12, bottom: 0 }}><defs><linearGradient id="studyGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#626fe8" stopOpacity={0.22} /><stop offset="100%" stopColor="#626fe8" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#edf0f6" vertical={false} /><XAxis dataKey="week" tick={{ fill: "#8993a8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8993a8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value} min`, "Study time"]} /><Area type="monotone" dataKey="minutes" stroke="#6472e8" strokeWidth={2.5} fill="url(#studyGradient)" /></AreaChart></ResponsiveContainer></div> : <EmptyChart text="Log a session to start building your study rhythm." />}</div>
              <section className="panel sessions-panel"><div className="panel-heading"><div><h2>Recent sessions</h2><p>Your latest logged study blocks</p></div></div>{sessions.length ? <div className="session-list">{sessions.map((item) => <div className="session-row" key={item._id}><span className="session-row-icon"><Clock3 size={17} /></span><div className="session-main"><strong>{item.assignmentId?.title ?? "Assignment"}</strong><span>{item.assignmentId?.subject ?? "Subject"} · {dateLabel(item.sessionDate)}{item.notes ? ` · ${item.notes}` : ""}</span></div><b>{durationLabel(item.durationMinutes)}</b><button className="icon-button subtle-danger" onClick={() => void deleteSession(item)} aria-label={`Delete session for ${item.assignmentId?.title}`}><Trash2 size={15} /></button></div>)}</div> : <div className="empty-inline"><Clock3 size={20} /><span>Nothing logged yet. A short study session is a great start.</span><button onClick={() => setSessionOpen(true)}>Log a session</button></div>}</section>
            </section>}
            {page === "Analytics" && <section>
              <div className="page-heading"><div><div className="eyebrow"><Activity size={14} /> KNOW YOUR WORKLOAD</div><h1>Analytics<span className="heading-period">.</span></h1><p>Every chart is calculated from your saved MongoDB records.</p></div><button className="button secondary" onClick={() => void refresh()}><Activity size={16} /> Refresh data</button></div>
              <div className="stat-grid"><StatCard icon={BookOpen} label="Assignments" value={total} detail="All recorded work" tone="blue" /><StatCard icon={CheckCircle2} label="Completed" value={completed} detail="Marked 100% complete" tone="teal" /><StatCard icon={ShieldAlert} label="Overdue" value={dashboard?.overdue ?? 0} detail="Past due and unfinished" tone="rose" /><StatCard icon={Clock3} label="Study time" value={durationLabel(studyMinutes)} detail={`${sessions.length} sessions`} tone="violet" /></div>
              <div className="analytics-grid"><div className="panel"><div className="panel-heading"><div><h2>Status breakdown</h2><p>Stored assignment status</p></div></div><div className="analytics-bars">{(dashboard?.statusCounts ?? []).map((row, index) => <div className="analytics-bar-row" key={row._id}><div><span>{row._id}</span><strong>{row.count}</strong></div><div className="bar-track"><i style={{ width: `${total ? Math.max(3, row.count / total * 100) : 0}%`, backgroundColor: colors[index] }} /></div></div>)}</div></div><div className="panel"><div className="panel-heading"><div><h2>Risk distribution</h2><p>Computed score categories</p></div></div><div className="analytics-bars">{(dashboard?.riskCounts ?? []).map((row, index) => <div className="analytics-bar-row" key={row._id}><div><span>{row._id}</span><strong>{row.count}</strong></div><div className="bar-track"><i style={{ width: `${total ? Math.max(3, row.count / total * 100) : 0}%`, backgroundColor: row._id === "High" ? "#e77474" : row._id === "Medium" ? "#f0b35c" : colors[index] }} /></div></div>)}</div></div></div>
              <section className="panel report-panel"><div className="panel-heading"><div><h2>Assignment report</h2><p>Joined with study sessions using MongoDB $lookup</p></div><select value={reportSubject} onChange={(event) => setReportSubject(event.target.value)} aria-label="Filter report by subject"><option value="">All subjects</option>{dashboard?.subjects.map((row) => <option key={row._id}>{row._id}</option>)}</select></div><div className="report-table-wrap"><table><thead><tr><th>Assignment</th><th>Subject</th><th>Status</th><th>Risk</th><th>Progress</th><th>Study time</th></tr></thead><tbody>{reportRows.map((row) => <tr key={row._id}><td><strong>{row.title}</strong><small>Due {dateLabel(row.dueDate)}</small></td><td>{row.subject}</td><td><span className={`status-pill ${row.status.toLowerCase().replace(" ", "-")}`}>{row.status}</span></td><td><RiskPill level={row.riskLevel} score={row.riskScore} /></td><td>{row.completionPercentage}%</td><td>{durationLabel(row.studyMinutes)}</td></tr>)}</tbody></table>{!reportRows.length && <div className="empty-inline"><span>No assignment records for this selection.</span></div>}</div></section>
              <div className="panel subject-table"><div className="panel-heading"><div><h2>Work by subject</h2><p>Estimated effort and average completion</p></div></div>{dashboard?.subjects.length ? <div className="subject-list">{dashboard.subjects.map((row, i) => <div className="subject-row" key={row._id}><span className="subject-color" style={{ background: colors[i % colors.length] }} /><strong>{row._id}</strong><span>{row.count} assignment{row.count === 1 ? "" : "s"}</span><span>{row.estimatedHours}h estimated</span><span>{Math.round(row.averageCompletion)}% avg. complete</span></div>)}</div> : <EmptyChart text="Add assignments to see subject totals." />}</div>
            </section>}
            {page === "Profile" && <section>
              <div className="page-heading"><div><div className="eyebrow"><Settings2 size={14} /> YOUR SPACE, YOUR DETAILS</div><h1>Student profile<span className="heading-period">.</span></h1><p>Your account and coursework are saved in MongoDB.</p></div><button className="button secondary" onClick={() => void logout()}><LogOut size={15} /> Log out</button></div>
              <form className="panel profile-panel" onSubmit={(event) => void saveProfile(event)}><div className="profile-banner"><div className="profile-big-avatar">{student?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "DR"}</div><div><h2>{student?.name ?? "Student"}</h2><p>{student?.email} <span className="live-tag"><i /> MONGODB</span></p></div></div><div className="form-grid"><label className="field"><span>Full name</span><input required maxLength={100} value={student?.name ?? ""} onChange={(e) => setStudent((prev) => prev ? { ...prev, name: e.target.value } : prev)} /></label><label className="field"><span>Email address</span><input required type="email" value={student?.email ?? ""} onChange={(e) => setStudent((prev) => prev ? { ...prev, email: e.target.value } : prev)} /></label><label className="field"><span>Department</span><input value={student?.department ?? ""} onChange={(e) => setStudent((prev) => prev ? { ...prev, department: e.target.value } : prev)} /></label><label className="field"><span>Semester</span><select value={student?.semester ?? 8} onChange={(e) => setStudent((prev) => prev ? { ...prev, semester: Number(e.target.value) } : prev)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Semester {index + 1}</option>)}</select></label></div><div className="profile-foot"><span>Changes are saved to your student record.</span><button className="button primary" disabled={profileBusy}><Check size={16} /> Save profile</button></div></form>
              <div className="panel tip-panel"><span className="tip-icon"><Sparkles size={18} /></span><div><h3>How your risk score works</h3><p>Deadline proximity contributes up to 40 points, difficulty up to 30, and remaining work up to 30. Completed assignments always have zero risk. See the README for the full formula and examples.</p></div></div>
            </section>}
          </>}
      </main>
      <footer className="footer"><span>Deadline Radar <span>·</span> Stay a step ahead.</span><span>Built for focus, not pressure <Sparkles size={13} /></span></footer>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{pages.slice(0, 4).map(({ label, icon: Icon }) => <button key={label} className={page === label ? "selected" : ""} onClick={() => setPage(label)}><Icon size={19} /><span>{label === "Study sessions" ? "Study" : label}</span></button>)}</nav>

    {assignmentOpen && <Modal title={editing ? "Edit assignment" : "Create assignment"} subtitle="Break the deadline into something you can actually work with." onClose={() => setAssignmentOpen(false)}>
      <form className="modal-form" onSubmit={(event) => void saveAssignment(event)}>
        <div className="form-grid"><label className="field full"><span>Assignment title</span><input autoFocus required maxLength={140} placeholder="e.g. Machine learning project report" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} /></label><label className="field"><span>Subject</span><input required maxLength={100} placeholder="e.g. Database systems" value={assignmentForm.subject} onChange={(e) => setAssignmentForm({ ...assignmentForm, subject: e.target.value })} /></label><label className="field"><span>Due date & time</span><input required type="datetime-local" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} /></label><label className="field"><span>Difficulty</span><select value={assignmentForm.difficulty} onChange={(e) => setAssignmentForm({ ...assignmentForm, difficulty: e.target.value })}><option>Easy</option><option>Medium</option><option>Hard</option></select></label><label className="field"><span>Estimated study hours</span><input required type="number" min="0.25" max="500" step="0.25" value={assignmentForm.estimatedHours} onChange={(e) => setAssignmentForm({ ...assignmentForm, estimatedHours: e.target.value })} /></label><label className="field full"><span>Completion · {assignmentForm.completionPercentage}%</span><input type="range" min="0" max="100" step="5" value={assignmentForm.completionPercentage} onChange={(e) => setAssignmentForm({ ...assignmentForm, completionPercentage: e.target.value })} /><small>At 100%, this assignment is automatically marked complete.</small></label><label className="field full"><span>Description <small>(optional)</small></span><textarea rows={3} maxLength={2000} placeholder="What needs to be done?" value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} /></label></div>
        <div className="checklist-editor"><div className="checklist-title"><span>Task checklist</span><small>Embedded in this assignment document</small></div>{assignmentForm.checklist.map((item, index) => <div className="checklist-edit-row" key={index}><input type="checkbox" checked={item.completed} onChange={() => setAssignmentForm({ ...assignmentForm, checklist: assignmentForm.checklist.map((entry, i) => i === index ? { ...entry, completed: !entry.completed } : entry) })} /><span>{item.text}</span><button type="button" className="icon-button" onClick={() => setAssignmentForm({ ...assignmentForm, checklist: assignmentForm.checklist.filter((_, i) => i !== index) })} aria-label="Remove checklist item"><X size={14} /></button></div>)}<div className="add-check-row"><input value={checklistDraft} maxLength={160} placeholder="Add a task…" onChange={(e) => setChecklistDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (checklistDraft.trim()) { setAssignmentForm({ ...assignmentForm, checklist: [...assignmentForm.checklist, { text: checklistDraft.trim(), completed: false }] }); setChecklistDraft(""); } } }} /><button type="button" onClick={() => { if (checklistDraft.trim()) { setAssignmentForm({ ...assignmentForm, checklist: [...assignmentForm.checklist, { text: checklistDraft.trim(), completed: false }] }); setChecklistDraft(""); } }}>Add task</button></div></div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setAssignmentOpen(false)}>Cancel</button><button className="button primary"><Check size={16} /> {editing ? "Save changes" : "Create assignment"}</button></div>
      </form>
    </Modal>}
    {sessionOpen && <Modal title="Log a study session" subtitle="Record your time. Assignment progress is still updated separately." onClose={() => setSessionOpen(false)}><form className="modal-form" onSubmit={(event) => void saveSession(event)}><div className="form-grid"><label className="field full"><span>Assignment</span><select required value={sessionForm.assignmentId} onChange={(e) => setSessionForm({ ...sessionForm, assignmentId: e.target.value })}><option value="">Choose an assignment</option>{assignments.map((item) => <option key={item._id} value={item._id}>{item.title} · {item.subject}</option>)}</select></label><label className="field"><span>Date & time</span><input required type="datetime-local" value={sessionForm.sessionDate} onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })} /></label><label className="field"><span>Duration in minutes</span><input required type="number" min="1" max="1440" value={sessionForm.durationMinutes} onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: e.target.value })} /></label><label className="field full"><span>Notes <small>(optional)</small></span><textarea rows={3} maxLength={1000} placeholder="What did you work on?" value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} /></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setSessionOpen(false)}>Cancel</button><button className="button primary" disabled={!assignments.length}><Check size={16} /> Save session</button></div></form></Modal>}
    {viewing && <Modal title={viewing.title} subtitle={viewing.subject} onClose={() => setViewing(null)}><div className="detail-modal"><div className="detail-badges"><RiskPill level={viewing.riskLevel} score={viewing.riskScore} /><span className={`status-pill ${viewing.status.toLowerCase().replace(" ", "-")}`}>{viewing.status}</span></div><div className="detail-stats"><div><span>Due date</span><strong>{dateLabel(viewing.dueDate)}</strong><small>{dueLabel(viewing.dueDate)}</small></div><div><span>Difficulty</span><strong>{viewing.difficulty}</strong></div><div><span>Estimated effort</span><strong>{viewing.estimatedHours} hours</strong></div><div><span>Completion</span><strong>{viewing.completionPercentage}%</strong></div></div><div className="detail-risk"><ShieldAlert size={17} /><span>{viewing.riskExplanation}</span></div><div className="detail-description"><h3>Description</h3><p>{viewing.description || "No description added yet."}</p></div>{viewing.checklist?.length > 0 && <div className="detail-description"><h3>Checklist · {viewing.checklist.filter((entry) => entry.completed).length}/{viewing.checklist.length} done</h3>{viewing.checklist.map((entry) => <div className={`detail-check ${entry.completed ? "checked" : ""}`} key={entry._id}>{entry.completed ? <Check size={14} /> : <span />}{entry.text}</div>)}</div>}<div className="modal-actions"><button className="button secondary" onClick={() => { const item = viewing; setViewing(null); openAssignment(item); }}><Settings2 size={15} /> Edit assignment</button><button className="button primary" onClick={() => setViewing(null)}>Done</button></div></div></Modal>}
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}<button aria-label="Dismiss" onClick={() => setToast("")}><X size={14} /></button></div>}
  </div>;
}

function StatCard({ icon: Icon, label, value, detail, tone, progress }: { icon: typeof BookOpen; label: string; value: string | number; detail: string; tone: string; progress?: number }) {
  return <div className="stat-card"><div className="stat-top"><span className={`stat-icon ${tone}`}><Icon size={18} /></span><span className="stat-label">{label}</span><span className={`stat-indicator ${tone}`} /></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div>{progress !== undefined && <div className="stat-progress"><i style={{ width: `${progress}%` }} /></div>}</div>;
}
function RiskPill({ level, score }: { level: string; score?: number }) {
  return <span className={`risk-pill ${level.toLowerCase()}`}><i />{level === "Completed" ? "Done" : `${level}${score !== undefined ? ` · ${score}` : ""}`}</span>;
}
function AssignmentRow({ item, onView, onEdit, onDelete, onToggle, compact = false }: { item: Assignment; onView: () => void; onEdit: () => void; onDelete: () => void; onToggle: (id: string) => void; compact?: boolean }) {
  const completedTasks = item.checklist?.filter((entry) => entry.completed).length ?? 0;
  return <article className={`assignment-row ${compact ? "compact" : ""}`}>
    <div className="assignment-marker"><span className={`risk-marker ${item.riskLevel.toLowerCase()}`} /></div>
    <div className="assignment-body">
      <div className="assignment-titleline"><h3><button className="assignment-title-button" onClick={onView}>{item.title}</button></h3><RiskPill level={item.riskLevel} score={item.riskScore} /><span className={`status-pill ${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span></div>
      <div className="assignment-meta"><span><BookOpen size={13} />{item.subject}</span><span><CalendarDays size={13} />{dateLabel(item.dueDate)}</span><span><Clock3 size={13} />{dueLabel(item.dueDate)}</span><span>{item.difficulty} · {item.estimatedHours}h planned</span></div>
      {!compact && <><div className="assignment-progress"><div className="progress-track"><i style={{ width: `${item.completionPercentage}%` }} /></div><span>{item.completionPercentage}%</span></div><p className="risk-explanation">{item.riskExplanation}</p>{item.checklist?.length > 0 && <div className="row-checklist"><span className="checklist-count"><ListChecks size={13} /> {completedTasks}/{item.checklist.length} tasks</span>{item.checklist.slice(0, 3).map((entry) => <button key={entry._id} className={`check-chip ${entry.completed ? "checked" : ""}`} onClick={() => onToggle(entry._id)} title={entry.text}>{entry.completed ? <Check size={12} /> : <span className="chip-empty" />}{entry.text}</button>)}</div>}</>}
    </div>
    <div className="row-actions"><button className="icon-button" title="Edit assignment" onClick={onEdit}><Settings2 size={16} /></button><button className="icon-button subtle-danger" title="Delete assignment" onClick={onDelete}><Trash2 size={16} /></button></div>
  </article>;
}
function EmptyChart({ text }: { text: string }) { return <div className="chart-empty"><span><Activity size={19} /></span><p>{text}</p></div>; }
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</section></div>;
}

export default App;
