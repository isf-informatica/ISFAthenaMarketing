import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Workflow, Users, CheckCircle2, Percent, X, Pencil, Loader2, IndianRupee } from "lucide-react";

const CHANNEL_OPTIONS = ["Email", "WhatsApp", "SMS", "Email, WhatsApp", "Email, SMS"];
const STATUS_OPTIONS = ["Draft", "Running", "Paused"];

const API_BASE_URL = "http://localhost:8000";
const AUTOMATIONS_ENDPOINT = `${API_BASE_URL}/automations`;

const statusStyles = {
    Running: "bg-green-500/10 text-green-400 border-green-600/30",
    Paused: "bg-gray-500/10 text-gray-400 border-gray-600/30",
    Draft: "bg-purple-500/10 text-purple-400 border-purple-600/30",
};

const emptyForm = { name: "", channel: CHANNEL_OPTIONS[0], status: "Draft", budget: "" };

/* ==========================================================
   CREATE AUTOMATION MODAL
   Simple controlled form — validates name is
   filled, then hands the new automation back to the parent.
========================================================== */
const CreateAutomationModal = ({ onClose, onCreate, creating, createError }) => {
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState("");

    const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError("Workflow name is required.");
            return;
        }
        setError("");
        onCreate({
            name: form.name.trim(),
            channel: form.channel,
            status: form.status,
            budget: Math.max(0, Number(form.budget) || 0),
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={onClose}
        >
            <div
                className="bg-[#0a0a0a] border border-orange-600/30 rounded-2xl w-full max-w-lg p-6 sm:p-8 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-gray-500 hover:text-white transition"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white">Create Automation</h2>
                <p className="text-gray-400 text-sm mt-1">
                    Set up a new automated workflow.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                            Workflow Name
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={update("name")}
                            placeholder="e.g. Birthday Offer Flow"
                            className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                                Channel
                            </label>
                            <select
                                value={form.channel}
                                onChange={update("channel")}
                                className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
                            >
                                {CHANNEL_OPTIONS.map((c) => (
                                    <option key={c} value={c} className="bg-[#0a0a0a]">
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                                Status
                            </label>
                            <select
                                value={form.status}
                                onChange={update("status")}
                                className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s} className="bg-[#0a0a0a]">
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                            Budget (₹)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.budget}
                            onChange={update("budget")}
                            placeholder="e.g. 25000"
                            className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition"
                        />
                        <p className="text-gray-500 text-[11px] mt-1">
                            Planned/actual spend for this workflow — feeds the Marketing Spend card in Analytics & BI.
                        </p>
                    </div>

                    {(error || createError) && <p className="text-red-400 text-xs">{error || createError}</p>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={creating}
                            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={creating}
                            className="bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-60"
                        >
                            {creating ? "Saving..." : "Create Automation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ==========================================================
   EDIT AUTOMATION STATS MODAL
   Manually update status/enrolled/completed/conversion — since
   there's no execution engine wired up yet to fill these in
   automatically, the person enters real numbers themselves
   (e.g. copied from the WhatsApp/Email provider's own dashboard).
========================================================== */
const EditAutomationModal = ({ automation, onClose, onSave, saving, saveError }) => {
    const [form, setForm] = useState({
        status: automation.status,
        enrolled: String(automation.enrolled ?? 0),
        completed: String(automation.completed ?? 0),
        conversion_rate: String(automation.conversion_rate ?? 0),
        budget: String(automation.budget ?? 0),
    });

    const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            status: form.status,
            enrolled: Math.max(0, Number(form.enrolled) || 0),
            completed: Math.max(0, Number(form.completed) || 0),
            conversion_rate: Math.max(0, Number(form.conversion_rate) || 0),
            budget: Math.max(0, Number(form.budget) || 0),
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={onClose}
        >
            <div
                className="bg-[#0a0a0a] border border-orange-600/30 rounded-2xl w-full max-w-md p-6 sm:p-8 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-gray-500 hover:text-white transition"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white">Update Stats</h2>
                <p className="text-gray-400 text-sm mt-1 truncate">{automation.workflow_name}</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Status</label>
                        <select
                            value={form.status}
                            onChange={update("status")}
                            className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s} className="bg-[#0a0a0a]">
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Enrolled</label>
                            <input
                                type="number"
                                min="0"
                                value={form.enrolled}
                                onChange={update("enrolled")}
                                className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Completed</label>
                            <input
                                type="number"
                                min="0"
                                value={form.completed}
                                onChange={update("completed")}
                                className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Conversion Rate (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={form.conversion_rate}
                                onChange={update("conversion_rate")}
                                className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Budget (₹)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.budget}
                                onChange={update("budget")}
                                className="w-full bg-white/5 border border-white/10 focus:border-orange-600/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
                            />
                        </div>
                    </div>

                    {saveError && <p className="text-red-400 text-xs">{saveError}</p>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-1.5 bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-60"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ==========================================================
   CAMPAIGN AUTOMATION (id="sec-campaign-automation")
========================================================== */
const CampaignAutomation = () => {
    const [automations, setAutomations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [isModalOpen, setModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    const [editingAutomation, setEditingAutomation] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [saveEditError, setSaveEditError] = useState("");

    const fetchAutomations = async () => {
        setLoading(true);
        setLoadError("");
        try {
            const res = await fetch(AUTOMATIONS_ENDPOINT, { method: "GET" });
            const resp = await res.json();
            if (res.ok && resp.success && Array.isArray(resp.data)) {
                setAutomations(resp.data);
            } else {
                setAutomations([]);
                setLoadError(resp.message || "Couldn't load automations.");
            }
        } catch (err) {
            setAutomations([]);
            setLoadError("Couldn't load automations. Check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAutomations();
    }, []);

    // Arrived here via Dashboard's "Create Campaign" Quick Action? Open the
    // create-automation modal automatically, then clear the nav state so a
    // refresh/back doesn't reopen it.
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (location.state?.openCreateAutomation) {
            setModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // Saves to isfathena.campaign_automations via main.py — no more
    // local-only state. Field names/types are mapped to what the backend
    // expects (workflow_name, conversion_rate, enrolled/completed as
    // numbers) before posting.
    const handleCreate = async (newAutomation) => {
        setCreating(true);
        setCreateError("");
        try {
            const res = await fetch(AUTOMATIONS_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflow_name: newAutomation.name,
                    channel: newAutomation.channel,
                    status: newAutomation.status,
                    enrolled: 0,
                    completed: 0,
                    conversion_rate: 0,
                    budget: newAutomation.budget,
                }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) {
                throw new Error(resp?.message || "Could not save automation");
            }
            setModalOpen(false);
            fetchAutomations(); // refresh from the DB so the table shows the real saved row
        } catch (err) {
            setCreateError("Could not save this automation. Please try again.");
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateStats = async (statsPayload) => {
        if (!editingAutomation) return;
        setSavingEdit(true);
        setSaveEditError("");
        try {
            const res = await fetch(`${AUTOMATIONS_ENDPOINT}/${editingAutomation.id}/stats`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(statsPayload),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) {
                throw new Error(resp?.error || "Could not update automation");
            }
            setEditingAutomation(null);
            fetchAutomations(); // refresh so the KPI cards + table reflect the new numbers
        } catch (err) {
            setSaveEditError("Could not save changes. Please try again.");
        } finally {
            setSavingEdit(false);
        }
    };

    const runningCount = automations.filter((a) => a.status === "Running").length;

    // Real sums/averages from the fetched automations — no fabricated
    // month-over-month deltas since no history is tracked yet.
    const totalEnrolled = automations.reduce((sum, a) => sum + (Number(a.enrolled) || 0), 0);
    const totalCompleted = automations.reduce((sum, a) => sum + (Number(a.completed) || 0), 0);
    const completionRate = totalEnrolled > 0 ? ((totalCompleted / totalEnrolled) * 100).toFixed(1) : "0.0";
    // Weighted by enrollment so a workflow with 2 contacts doesn't skew the
    // average as much as one with 2,000.
    const avgConversion =
        totalEnrolled > 0
            ? (automations.reduce((sum, a) => sum + (Number(a.conversion_rate) || 0) * (Number(a.enrolled) || 0), 0) / totalEnrolled).toFixed(1)
            : "0.0";
    const totalBudget = automations.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
    const formatBudget = (num) => {
        const n = Number(num) || 0;
        return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;
    };

    const automationKpis = [
        { icon: Workflow, value: String(automations.length), label: "Total Workflows", sub: `${runningCount} running` },
        { icon: IndianRupee, value: formatBudget(totalBudget), label: "Total Budget", sub: `Across ${automations.length} workflow${automations.length !== 1 ? "s" : ""}` },
        { icon: Users, value: totalEnrolled.toLocaleString("en-IN"), label: "Contacts Enrolled", sub: `Across ${automations.length} workflow${automations.length !== 1 ? "s" : ""}` },
        { icon: CheckCircle2, value: totalCompleted.toLocaleString("en-IN"), label: "Completed", sub: `${completionRate}% completion rate` },
        { icon: Percent, value: `${avgConversion}%`, label: "Avg Conversion", sub: "Weighted by enrollment" },
    ];

    return (
        <div id="sec-campaign-automation" className="h-full flex flex-col py-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Campaign Automation</h1>
                    <p className="text-gray-400 mt-1.5 text-sm">
                        Build and manage automated marketing workflows.
                    </p>
                </div>

                <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition"
                >
                    <Plus size={16} />
                    Create Automation
                </button>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 mt-8">
                {automationKpis.map((kpi, index) => {
                    const Icon = kpi.icon;
                    return (
                        <div
                            key={index}
                            className={`bg-black border rounded-2xl p-5 ${kpi.muted ? "border-white/10 opacity-60" : "border-orange-600/30"}`}
                        >
                            <Icon className={`mb-3 ${kpi.muted ? "text-gray-500" : "text-orange-500"}`} size={20} />
                            <h3 className="text-2xl font-bold text-white">{kpi.value}</h3>
                            <p className="text-gray-400 text-xs mt-1">{kpi.label}</p>
                            <p className={`text-xs mt-1 font-semibold ${kpi.muted ? "text-gray-500" : "text-green-400"}`}>{kpi.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* Automation table */}
            <div className="flex-1 min-h-0 bg-black border border-orange-600/30 rounded-2xl mt-8 overflow-hidden flex flex-col">
                <div className="overflow-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="border-b border-orange-600/20 text-gray-500 text-xs uppercase tracking-wide">
                                <th className="px-6 py-4 font-semibold">Workflow Name</th>
                                <th className="px-6 py-4 font-semibold">Channel</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Enrolled</th>
                                <th className="px-6 py-4 font-semibold">Completed</th>
                                <th className="px-6 py-4 font-semibold">Conversion</th>
                                <th className="px-6 py-4 font-semibold">Budget</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                                        Loading automations...
                                    </td>
                                </tr>
                            )}
                            {!loading && loadError && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-red-400">
                                        {loadError}
                                    </td>
                                </tr>
                            )}
                            {!loading && !loadError && automations.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                                        No automations yet — click "Create Automation" to add one.
                                    </td>
                                </tr>
                            )}
                            {!loading && !loadError && automations.map((a, index) => (
                                <tr
                                    key={a.id ?? index}
                                    className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition"
                                >
                                    <td className="px-6 py-4 text-white font-medium whitespace-nowrap">{a.workflow_name}</td>
                                    <td className="px-6 py-4 text-orange-400 whitespace-nowrap">{a.channel}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${statusStyles[a.status]}`}
                                        >
                                            {a.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">{a.enrolled}</td>
                                    <td className="px-6 py-4 text-gray-300">{a.completed}</td>
                                    <td className="px-6 py-4 text-orange-400 font-semibold">{Number(a.conversion_rate).toFixed(1)}%</td>
                                    <td className="px-6 py-4 text-gray-300">{formatBudget(a.budget)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => {
                                                setSaveEditError("");
                                                setEditingAutomation(a);
                                            }}
                                            title="Update stats"
                                            className="inline-flex items-center gap-1.5 border border-white/10 hover:border-orange-500/50 hover:text-orange-400 text-gray-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                                        >
                                            <Pencil size={12} /> Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <CreateAutomationModal
                    onClose={() => setModalOpen(false)}
                    onCreate={handleCreate}
                    creating={creating}
                    createError={createError}
                />
            )}

            {editingAutomation && (
                <EditAutomationModal
                    automation={editingAutomation}
                    onClose={() => setEditingAutomation(null)}
                    onSave={handleUpdateStats}
                    saving={savingEdit}
                    saveError={saveEditError}
                />
            )}
        </div>
    );
};

export default CampaignAutomation;