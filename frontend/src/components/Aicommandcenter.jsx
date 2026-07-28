import React, { useState, useMemo } from "react";
import {
  Bot,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  Play,
  Pause,
  Settings,
  ShoppingBag,
  Activity,
  Brain,
  Database,
  ArrowRight,
  ArrowDown,
  AlertCircle,
  DollarSign,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Megaphone,
  Users,
  MessageSquare,
  LineChart,
  Target,
  X,
  Check,
  Wallet,
  Gauge,
  History,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  GrowthOS AI — AI Command Center                                    */
/*  Control layer for existing modules (Dashboard, Lead Management,    */
/*  Sales Pipeline, Customer 360, Campaign Automation, Analytics,      */
/*  AI Copilot). This page does NOT duplicate those modules — it       */
/*  supervises the AI employees that operate inside them.              */
/* ------------------------------------------------------------------ */

/* ---------------------------- Mock data ---------------------------- */

const KPIS = [
  { id: "agents", label: "Active AI Agents", value: "5", trend: "+1 this week", icon: Bot, status: "live" },
  { id: "tasks", label: "Running Tasks", value: "23", trend: "+6 vs yesterday", icon: Activity, status: "live" },
  { id: "automations", label: "Automations Today", value: "148", trend: "+12%", icon: Zap, status: "live" },
  { id: "revenue", label: "Revenue Influenced", value: "$84,200", trend: "+18.4%", icon: DollarSign, status: "live" },
  { id: "success", label: "Success Rate", value: "96.2%", trend: "+1.1 pts", icon: CheckCircle2, status: "healthy" },
  { id: "response", label: "Avg. Response Time", value: "1.4s", trend: "-0.3s", icon: Gauge, status: "healthy" },
];

const AGENTS = [
  {
    id: "marketing",
    name: "AI Marketing Manager",
    role: "Manages Campaign Automation",
    module: "Campaign Automation",
    modules: ["Campaign Automation"],
    goal: "Increase Lead Generation",
    task: "Optimizing WhatsApp Campaign",
    confidence: 92,
    tasksToday: 34,
    lastAction: "Adjusted budget split across 3 audiences",
    roi: "+$21,400",
    status: "Running",
    icon: Megaphone,
    can: ["Launch Campaign", "Segment Audience", "Generate Content", "Optimize Budget"],
  },
  {
    id: "sales",
    name: "AI Sales Representative",
    role: "Works inside Lead Management & Sales Pipeline",
    module: "Lead Management",
    modules: ["Lead Management", "Sales Pipeline"],
    goal: "Convert Hot Leads",
    task: "Following up with 8 high-score leads",
    confidence: 88,
    tasksToday: 41,
    lastAction: "Sent proposal to Meridian Corp",
    roi: "+$32,800",
    status: "Working",
    icon: Target,
    can: ["Score Leads", "Generate Proposal", "Schedule Follow-up", "Move Deal"],
  },
  {
    id: "success",
    name: "AI Customer Success Agent",
    role: "Works inside Customer 360",
    module: "Customer 360",
    modules: ["Customer 360"],
    goal: "Increase Customer Engagement",
    task: "Resolving customer queries",
    confidence: 95,
    tasksToday: 27,
    lastAction: "Replied to 6 support threads",
    roi: "+$6,900",
    status: "Running",
    icon: Users,
    can: ["Generate Replies", "Schedule Meetings", "Summarize Customer History", "Recommend Next Action"],
  },
  {
    id: "analytics",
    name: "AI Analytics Agent",
    role: "Works inside Analytics & BI",
    module: "Analytics & BI",
    modules: ["Analytics & BI"],
    goal: "Improve Revenue",
    task: "Analyzing sales trends",
    confidence: 90,
    tasksToday: 19,
    lastAction: "Flagged a 14% dip in mid-funnel drop-off",
    roi: "+$11,300",
    status: "Analyzing",
    icon: LineChart,
    can: ["Forecast Revenue", "Explain Reports", "Detect Anomalies", "Predict Pipeline"],
  },
  {
    id: "growth",
    name: "AI Growth Strategist",
    role: "Coordinates all other agents",
    module: "All Modules",
    modules: ["Dashboard", "Lead Management", "Sales Pipeline", "Customer 360", "Campaign Automation", "Analytics & BI"],
    goal: "Increase Monthly Revenue",
    task: "Evaluating business performance",
    confidence: 84,
    tasksToday: 12,
    lastAction: "Recommended shifting budget toward WhatsApp",
    roi: "+$11,800",
    status: "Thinking",
    icon: Brain,
    can: ["Budget Allocation", "Business Strategy", "Growth Suggestions", "Competitor Monitoring"],
  },
];

const STATUS_STYLES = {
  Running: { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10" },
  Working: { dot: "bg-orange-500", text: "text-orange-400", bg: "bg-orange-500/10" },
  Analyzing: { dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-400/10" },
  Thinking: { dot: "bg-violet-400", text: "text-violet-400", bg: "bg-violet-400/10" },
  Paused: { dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/10" },
};

const ACTIVITY_FEED = [
  { time: "10:02 AM", agent: "AI Marketing Manager", action: "Created WhatsApp re-engagement campaign", module: "Campaign Automation", success: true },
  { time: "09:58 AM", agent: "AI Sales Representative", action: "Qualified lead: Meridian Corp (score 91)", module: "Lead Management", success: true },
  { time: "09:51 AM", agent: "AI Customer Success Agent", action: "Generated reply for billing query #4521", module: "Customer 360", success: true },
  { time: "09:44 AM", agent: "AI Analytics Agent", action: "Detected 12% revenue increase in APAC segment", module: "Analytics & BI", success: true },
  { time: "09:37 AM", agent: "AI Growth Strategist", action: "Recommended budget shift to WhatsApp channel", module: "Campaign Automation", success: true },
  { time: "09:29 AM", agent: "AI Sales Representative", action: "Attempted follow-up call — no answer", module: "Sales Pipeline", success: false },
];

const APPROVAL_QUEUE = [
  { id: "q1", title: "Launch Summer Campaign", agent: "AI Marketing Manager", detail: "Estimated ROI: +$18,200", risk: "Low risk" },
  { id: "q2", title: "Send Proposal to Orion Retail", agent: "AI Sales Representative", detail: "Deal value: $42,000", risk: "Medium risk" },
  { id: "q3", title: "Reallocate Marketing Budget", agent: "AI Growth Strategist", detail: "Shift $6,000 → WhatsApp Ads", risk: "Requires approval" },
];

const EXECUTION_TIMELINE = [
  { time: "09:10", text: "Marketing Agent detected low lead volume" },
  { time: "09:12", text: "Created campaign" },
  { time: "09:15", text: "Requested approval" },
  { time: "09:18", text: "Campaign launched" },
  { time: "09:40", text: "Sales Agent followed up" },
  { time: "09:50", text: "Analytics updated dashboard" },
  { time: "10:00", text: "Growth Agent recommended increasing WhatsApp budget" },
];

const MEMORY = [
  { label: "Customer Memory", value: 82 },
  { label: "Campaign Memory", value: 74 },
  { label: "Sales Memory", value: 91 },
  { label: "Business Knowledge", value: 68 },
];

/* --------------------------- Small helpers -------------------------- */

function Card({ className = "", children, glow = false }) {
  return (
    <div
      className={`relative rounded-[20px] border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl ${
        glow ? "shadow-[0_0_40px_-12px_rgba(255,107,0,0.35)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Paused;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} animate-pulse`} />
      {status}
    </span>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500/80">
            {eyebrow}
          </div>
        )}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Header ------------------------------ */

function CommandHeader({ autopilotOn, onToggleAutopilot }) {
  return (
    <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">
          <Sparkles size={13} />
          Autonomous Workforce
        </div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">AI Command Center</h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-400">
          Manage autonomous AI employees that continuously optimize your business across Marketing, Sales,
          Customer Success and Analytics.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 hover:shadow-[0_0_24px_-6px_rgba(255,107,0,0.6)]">
          <Bot size={16} />
          Create Agent
        </button>
        <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-orange-500/40 hover:text-white">
          <ShoppingBag size={16} />
          Agent Marketplace
        </button>
        <button
          onClick={() => onToggleAutopilot(false)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/20"
        >
          <Pause size={16} />
          Pause All
        </button>
        <button
          onClick={() => onToggleAutopilot(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/20"
        >
          <Play size={16} />
          Resume All
        </button>
        <button className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-zinc-300 transition hover:border-white/20 hover:text-white">
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ KPI Row ------------------------------ */

function KPIRow() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {KPIS.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.id} className="group p-4 transition hover:border-orange-500/30 hover:bg-white/[0.035]">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 transition group-hover:bg-orange-500/20">
                <Icon size={17} />
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  kpi.status === "live" ? "bg-emerald-400/10 text-emerald-400" : "bg-sky-400/10 text-sky-400"
                }`}
              >
                {kpi.status === "live" ? "Live" : "Healthy"}
              </span>
            </div>
            <div className="mt-3 text-xl font-bold text-white">{kpi.value}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{kpi.label}</div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <TrendingUp size={12} />
              {kpi.trend}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------- AI Workforce ---------------------------- */

function AgentCard({ agent, paused, onTogglePause }) {
  const Icon = agent.icon;
  const status = paused ? "Paused" : agent.status;

  return (
    <Card className="flex flex-col p-5 transition hover:border-orange-500/30 hover:bg-white/[0.035]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/25 to-orange-600/5 text-orange-400 ring-1 ring-orange-500/20">
            <Icon size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{agent.name}</div>
            <div className="text-xs text-zinc-500">{agent.role}</div>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-zinc-500">Current Goal</div>
          <div className="mt-0.5 font-medium text-zinc-200">{agent.goal}</div>
        </div>
        <div>
          <div className="text-zinc-500">Current Task</div>
          <div className="mt-0.5 font-medium text-zinc-200">{agent.task}</div>
        </div>
        <div>
          <div className="text-zinc-500">Confidence</div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-orange-500" style={{ width: `${agent.confidence}%` }} />
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Tasks Today</div>
          <div className="mt-0.5 font-medium text-zinc-200">{agent.tasksToday}</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-3 text-xs">
        <div className="text-zinc-500">Last Action</div>
        <div className="mt-0.5 text-zinc-300">{agent.lastAction}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {agent.can.map((c) => (
          <span key={c} className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[10px] text-zinc-400">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <div className="text-xs text-zinc-500">
          Connected: <span className="text-zinc-300">{agent.modules.join(", ")}</span>
        </div>
        <div className="text-sm font-semibold text-emerald-400">{agent.roi}</div>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-500">
          Open Workspace
        </button>
        <button
          onClick={() => onTogglePause(agent.id)}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-zinc-300 transition hover:border-white/20 hover:text-white"
          title={paused ? "Resume agent" : "Pause agent"}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-zinc-300 transition hover:border-white/20 hover:text-white" title="Configure">
          <Settings size={14} />
        </button>
        <button className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-zinc-300 transition hover:border-white/20 hover:text-white" title="Activity log">
          <History size={14} />
        </button>
      </div>
    </Card>
  );
}

function AIWorkforce({ pausedAgents, onTogglePause }) {
  return (
    <div>
      <SectionHeading eyebrow="Workforce" title="AI Employees" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.id} agent={agent} paused={pausedAgents.has(agent.id)} onTogglePause={onTogglePause} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Activity ------------------------------ */

function LiveActivity() {
  return (
    <Card className="p-5">
      <SectionHeading
        eyebrow="Live Feed"
        title="Live AI Activity"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Streaming
          </span>
        }
      />
      <div className="space-y-1">
        {ACTIVITY_FEED.map((a, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl px-2 py-2.5 text-sm transition hover:bg-white/[0.03]"
          >
            <div className="mt-0.5 w-16 shrink-0 text-xs text-zinc-500">{a.time}</div>
            <div
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${a.success ? "bg-emerald-400" : "bg-red-400"}`}
            />
            <div className="flex-1">
              <span className="font-medium text-orange-400">{a.agent}</span>{" "}
              <span className="text-zinc-300">{a.action}</span>
              <div className="mt-0.5 text-xs text-zinc-500">{a.module}</div>
            </div>
            {!a.success && <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------ Module Connection Map ------------------------ */

function FlowNode({ label, sub, icon: Icon, accent = false }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${
        accent
          ? "border-orange-500/30 bg-orange-500/[0.06] shadow-[0_0_24px_-8px_rgba(255,107,0,0.4)]"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-zinc-300"}`}>
        <Icon size={15} />
      </div>
      <div>
        <div className="text-xs font-semibold text-white">{label}</div>
        {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}

function ModuleConnectionMap() {
  return (
    <Card className="p-5">
      <SectionHeading eyebrow="Orchestration" title="Module Connection Map" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Marketing -> Campaign Automation */}
        <div className="flex flex-col items-center gap-2">
          <FlowNode label="Marketing Agent" icon={Megaphone} accent />
          <ArrowDown size={14} className="text-orange-500/50" />
          <FlowNode label="Campaign Automation" sub="module" icon={BarChart3} />
        </div>

        {/* Sales -> Lead Mgmt -> Sales Pipeline */}
        <div className="flex flex-col items-center gap-2">
          <FlowNode label="Sales Agent" icon={Target} accent />
          <ArrowDown size={14} className="text-orange-500/50" />
          <FlowNode label="Lead Management" sub="module" icon={Users} />
          <ArrowDown size={14} className="text-orange-500/50" />
          <FlowNode label="Sales Pipeline" sub="module" icon={LineChart} />
        </div>

        {/* Customer Agent -> Customer 360 */}
        <div className="flex flex-col items-center gap-2">
          <FlowNode label="Customer Agent" icon={MessageSquare} accent />
          <ArrowDown size={14} className="text-orange-500/50" />
          <FlowNode label="Customer 360" sub="module" icon={Users} />
        </div>

        {/* Analytics Agent -> Analytics */}
        <div className="flex flex-col items-center gap-2">
          <FlowNode label="Analytics Agent" icon={LineChart} accent />
          <ArrowDown size={14} className="text-orange-500/50" />
          <FlowNode label="Analytics & BI" sub="module" icon={BarChart3} />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 border-t border-white/[0.06] pt-6">
        <FlowNode label="Growth Strategist" sub="Coordinates every AI agent" icon={Brain} accent />
        <ArrowDown size={14} className="text-orange-500/50" />
        <div className="text-xs text-zinc-500">Oversees Dashboard → Lead Management → Sales Pipeline → Customer 360 → Campaign Automation → Analytics</div>
      </div>
    </Card>
  );
}

/* ------------------------------ Autopilot ------------------------------ */

function AutonomousMode({ autopilotOn, onToggle }) {
  return (
    <Card glow className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500/80">
            <ShieldCheck size={13} />
            Autonomy
          </div>
          <h3 className="text-lg font-semibold text-white">Business Autopilot</h3>
          <p className="mt-1 max-w-md text-sm text-zinc-400">
            Allow AI agents to automatically monitor business performance, optimize campaigns, follow up with
            leads, generate reports and recommend actions.
          </p>
        </div>
        <button
          onClick={() => onToggle(!autopilotOn)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${autopilotOn ? "bg-orange-600" : "bg-white/10"}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
              autopilotOn ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Human Approval", value: "Required for high-risk", icon: CheckCircle2 },
          { label: "Budget Limit", value: "$10,000 / mo", icon: Wallet },
          { label: "High Risk Actions", value: "2 flagged", icon: AlertCircle },
          { label: "Approval Queue", value: `${APPROVAL_QUEUE.length} pending`, icon: Clock },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
            <s.icon size={14} className="text-orange-400" />
            <div className="mt-2 text-xs text-zinc-500">{s.label}</div>
            <div className="text-sm font-medium text-white">{s.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------- Memory -------------------------------- */

function AIMemory() {
  return (
    <Card className="p-6">
      <div className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500/80">
        <Database size={13} />
        Knowledge
      </div>
      <h3 className="text-lg font-semibold text-white">Shared AI Memory</h3>

      <div className="mt-4 space-y-3">
        {MEMORY.map((m) => (
          <div key={m.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-zinc-400">{m.label}</span>
              <span className="text-zinc-300">{m.value}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-orange-500" style={{ width: `${m.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4 text-xs">
        <div>
          <div className="text-zinc-500">Learning Score</div>
          <div className="text-sm font-semibold text-white">8.7 / 10</div>
        </div>
        <div>
          <div className="text-zinc-500">Memory Usage</div>
          <div className="text-sm font-semibold text-white">64%</div>
        </div>
        <div>
          <div className="text-zinc-500">Vector DB</div>
          <div className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------ Multi-Agent Collaboration ------------------------ */

function CollaborationFlow() {
  const steps = [
    { label: "Marketing Agent", sub: "Generated Leads", icon: Megaphone },
    { label: "Sales Agent", sub: "Qualified Deals", icon: Target },
    { label: "Customer Agent", sub: "Customer Follow-up", icon: MessageSquare },
    { label: "Analytics Agent", sub: "Performance Analysis", icon: LineChart },
    { label: "Growth Agent", sub: "Business Recommendation", icon: Brain },
  ];

  return (
    <Card className="p-5">
      <SectionHeading eyebrow="Teamwork" title="Multi-Agent Collaboration" />
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                <s.icon size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{s.label}</div>
                <div className="text-[11px] text-zinc-500">{s.sub}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight size={16} className="mx-auto shrink-0 text-orange-500/40 lg:mx-1 lg:rotate-0 rotate-90" />
            )}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------- Action Approval Queue -------------------------- */

function ApprovalQueue() {
  const [items, setItems] = useState(APPROVAL_QUEUE);

  const resolve = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <Card className="p-5">
      <SectionHeading eyebrow="Awaiting You" title="Action Approval Queue" />
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-6 text-center text-sm text-zinc-500">
          Nothing pending — agents are clear to keep running.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-medium text-white">{item.title}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {item.agent} · {item.detail} · {item.risk}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resolve(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500"
                >
                  <Check size={13} />
                  Approve
                </button>
                <button
                  onClick={() => resolve(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20"
                >
                  <X size={13} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Execution Timeline ------------------------------ */

function ExecutionTimeline() {
  return (
    <Card className="p-5">
      <SectionHeading eyebrow="Trace" title="Execution Timeline" />
      <div className="relative pl-5">
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/10" />
        <div className="space-y-4">
          {EXECUTION_TIMELINE.map((step, i) => (
            <div key={i} className="relative flex items-start gap-3">
              <div className="absolute -left-5 mt-1 h-2.5 w-2.5 rounded-full border-2 border-[#050505] bg-orange-500" />
              <div className="w-14 shrink-0 text-xs text-zinc-500">{step.time}</div>
              <div className="text-sm text-zinc-300">{step.text}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function AICommandCenter() {
  const [autopilotOn, setAutopilotOn] = useState(true);
  const [pausedAgents, setPausedAgents] = useState(() => new Set());

  const handleGlobalToggle = (resume) => {
    setPausedAgents(resume ? new Set() : new Set(AGENTS.map((a) => a.id)));
  };

  const togglePause = (id) => {
    setPausedAgents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <CommandHeader autopilotOn={autopilotOn} onToggleAutopilot={handleGlobalToggle} />
        <KPIRow />
        <AIWorkforce pausedAgents={pausedAgents} onTogglePause={togglePause} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <LiveActivity />
          </div>
          <AIMemory />
        </div>

        <ModuleConnectionMap />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <AutonomousMode autopilotOn={autopilotOn} onToggle={setAutopilotOn} />
          </div>
          <ApprovalQueue />
        </div>

        <CollaborationFlow />
        <ExecutionTimeline />
      </div>
    </div>
  );
}