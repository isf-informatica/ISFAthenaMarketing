import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Plus, X, Loader2 } from "lucide-react";
import { useCustomerData } from "./CustomerDataContext";
import ReachableChannelsCard from "./ReachableChannelsCard";

/* ==========================================================
   FIELD CONFIG (mirrors prospectus.php "Add Lead Generation" form)
========================================================== */
const userTypeOptions = ["Family", "Friend"];
const countryOptions = ["India", "United State of America", "Canada"];
const gmbStatusOptions = ["Claimed", "Unclaimed", "Uncategorized"];
const assignedOptions = ["Tapan", "Andrew", "Surej", "Uncategorized"];
const statusOptions = ["Open", "Mail Send", "Phone Contacted", "Success", "Closed"];

const initialFormState = {
    user_type: "",
    country: "",
    user_name: "",
    user_address: "",
    gmb_status: "",
    web_url: "",
    user_num: "",
    user_email: "",
    assigned_prospect: "",
    connected_date: "",
    current_status: "",
    comment: "",
};

/* Validation helpers ported from prospectus.php */
const isValidName = (name) => /^([a-zA-Z]+\s)*[a-zA-Z]+$/.test(name) && name.length > 3 && name.length < 50;
const isValidNumber = (num) => /^[0-9]{10}$/.test(num);
const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);
const isValidUrl = (value) =>
    /^(?!mailto:)(?:(?:http|https|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[0-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))|localhost)(?::\d{2,5})?(?:(\/|\?|#)[^\s]*)?$/.test(
        value.trim()
    );

/* Reusable themed field wrapper */
const Field = ({ label, children, error, colSpan = "" }) => (
    <div className={colSpan}>
        <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">
            {label}
        </label>
        {children}
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
);

const inputClasses = (hasError) =>
    `w-full bg-black/60 border ${
        hasError ? "border-red-500/70" : "border-white/10"
    } rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/40 transition duration-200`;

const SelectField = ({ id, value, onChange, options, hasError, placeholder = "Select" }) => (
    <div className="relative">
        <select
            id={id}
            value={value}
            onChange={onChange}
            className={`${inputClasses(hasError)} appearance-none pr-10 cursor-pointer`}
        >
            <option value="" disabled>
                {placeholder}
            </option>
            {options.map((opt) => (
                <option key={opt} value={opt} className="bg-black text-white">
                    {opt}
                </option>
            ))}
        </select>
        <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
    </div>
);

/* ==========================================================
   API CONFIG (insert only — the list is now owned by
   CustomerDataContext so Customer 360 can share it)
========================================================== */
const API_BASE_URL = "http://localhost/easylearnv3.org.in";
const INSERT_PROSPECT_ENDPOINT = `${API_BASE_URL}/Easylearn/Configuration_Controller/insert_prospects`;

/* Table columns, mapped to the field names returned by get_prospect_list()
   (see Configuration_Model.php -> el_prospects table) */
const tableColumns = [
    { key: "user_name", label: "Name" },
    { key: "user_type", label: "User Type" },
    { key: "country", label: "Country" },
    { key: "gmb_status", label: "GMB Status" },
    { key: "user_address", label: "Address" },
    { key: "web_url", label: "Website" },
    { key: "user_mobile_number", label: "Mobile Number" },
    { key: "user_email", label: "Email" },
    { key: "assigned_prospect", label: "Assigned To" },
    { key: "connected_date", label: "Connected Date" },
    { key: "current_status", label: "Current Status" },
    { key: "prospect_comment", label: "Comment" },
];

const statusBadgeClasses = (status) => {
    const map = {
        Open: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        "Mail Send": "bg-purple-500/10 text-purple-400 border-purple-500/30",
        "Phone Contacted": "bg-amber-500/10 text-amber-400 border-amber-500/30",
        Success: "bg-green-500/10 text-green-400 border-green-500/30",
        Closed: "bg-gray-500/10 text-gray-400 border-gray-500/30",
    };
    return map[status] || "bg-orange-500/10 text-orange-400 border-orange-500/30";
};

/* ==========================================================
   NO-CODE CAMPAIGN BUILDER (id="sec-campaign-builder")
========================================================== */
const CampaignBuilderSection = () => {
    const [form, setForm] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);

    // Row double-clicked in the leads table — opens the Reachable
    // Channels + AI chat card for that lead in a modal.
    const [channelsLead, setChannelsLead] = useState(null);

    // Leads now come from the shared context (fetched once at the
    // dashboard level) instead of a local fetch — Customer 360 reads
    // the exact same list.
    const { leads, leadsLoading, leadsError, fetchLeads } = useCustomerData();

    // Lock background scrolling while any modal or success popup is open,
    // so the page behind can't scroll and bleed through the overlay.
    React.useEffect(() => {
        if (showFormModal || submitted || channelsLead) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [showFormModal, submitted, channelsLead]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = {};

        if (!isValidName(form.user_name.trim())) nextErrors.user_name = "Enter a valid name";
        if (!isValidUrl(form.web_url)) nextErrors.web_url = "Website URL is invalid";
        if (!isValidNumber(form.user_num)) nextErrors.user_num = "Enter a valid 10-digit number";
        if (!isValidEmail(form.user_email)) nextErrors.user_email = "Invalid email address";
        if (!form.user_type) nextErrors.user_type = "Select the type of lead";
        if (!form.country) nextErrors.country = "Select a country";

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        // Build the payload with the exact field names insert_prospects() expects
        // (see Configuration_Controller.php / prospectus.php's #prospect submit handler)
        const formdata = new FormData();
        formdata.append("user_type", form.user_type);
        formdata.append("country", form.country);
        formdata.append("user_name", form.user_name);
        formdata.append("user_address", form.user_address);
        formdata.append("gmb_status", form.gmb_status);
        formdata.append("web_url", form.web_url);
        formdata.append("user_mobile_number", form.user_num);
        formdata.append("user_email", form.user_email);
        formdata.append("assigned_prospect", form.assigned_prospect);
        formdata.append("connected_date", form.connected_date);
        formdata.append("current_status", form.current_status);
        formdata.append("prospect_comment", form.comment);

        setSubmitting(true);
        try {
            const res = await fetch(INSERT_PROSPECT_ENDPOINT, {
                method: "POST",
                body: formdata,
                credentials: "include", // sends the CI session cookie so account_id resolves server-side
            });
            const resp = await res.json();

            if (resp.data === "TRUE") {
                setSubmitted(true);
                setForm(initialFormState);
                setShowFormModal(false);
                fetchLeads(); // refresh the shared list — Customer 360 updates too
            } else {
                setErrors({ submit: "Could not save this lead. Please try again." });
            }
        } catch (err) {
            setErrors({ submit: "Network error — please check your connection and try again." });
        } finally {
            setSubmitting(false);
        }
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setErrors({});
    };

    return (
        <>
        <section id="sec-campaign-builder" className="h-full flex flex-col overflow-hidden relative z-10 py-4 sm:py-5">
            <div className="w-full h-full flex flex-col min-h-0 px-4 sm:px-6 lg:px-8">
                <div className="text-center shrink-0">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                        Lead Management
                    </h2>
                </div>

                <div className="mt-4 flex-1 min-h-0 bg-black border border-orange-600/30 rounded-[28px] p-4 sm:p-6 flex flex-col">
                    {/* Header row: title + Add Lead Generation button top-right */}
                    <div className="flex items-center justify-between gap-4 shrink-0">
                        <h3 className="font-bold text-lg sm:text-xl text-white">Lead Generation List</h3>
                        <button
                            type="button"
                            onClick={() => setShowFormModal(true)}
                            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 hover:shadow-[0_0_25px_rgba(249,115,22,0.35)] text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition duration-300 shrink-0"
                        >
                            <Plus size={16} />
                            Add Lead Generation
                        </button>
                    </div>

                    {/* Leads table — this one keeps its own internal scroll,
                        which is expected UX for a data table with many rows. */}
                    <div className="mt-4 flex-1 min-h-0 overflow-auto rounded-2xl border border-white/10">
                        <table className="min-w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-orange-500/10 border-b border-orange-600/30">
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Sr.no
                                    </th>
                                    {tableColumns.map((col) => (
                                        <th
                                            key={col.key}
                                            className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]"
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {leadsLoading && (
                                    <tr>
                                        <td colSpan={tableColumns.length + 1} className="px-4 py-10 text-center text-gray-400">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 size={16} className="animate-spin" />
                                                Loading leads...
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!leadsLoading && leadsError && (
                                    <tr>
                                        <td colSpan={tableColumns.length + 1} className="px-4 py-10 text-center text-red-400">
                                            {leadsError}
                                        </td>
                                    </tr>
                                )}

                                {!leadsLoading && !leadsError && leads.length === 0 && (
                                    <tr>
                                        <td colSpan={tableColumns.length + 1} className="px-4 py-10 text-center text-gray-400">
                                            No leads yet — click "Add Lead Generation" to create one.
                                        </td>
                                    </tr>
                                )}

                                {!leadsLoading &&
                                    !leadsError &&
                                    leads.map((lead, index) => (
                                        <tr
                                            key={lead.id ?? index}
                                            onDoubleClick={() => setChannelsLead(lead)}
                                            title="Double-click to contact this lead"
                                            className="border-b border-white/5 hover:bg-orange-500/5 cursor-pointer transition duration-150"
                                        >
                                            <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{index + 1}</td>
                                            {tableColumns.map((col) => (
                                                <td key={col.key} className="px-4 py-3 text-gray-300 whitespace-nowrap">
                                                    {col.key === "current_status" ? (
                                                        <span
                                                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeClasses(
                                                                lead[col.key]
                                                            )}`}
                                                        >
                                                            {lead[col.key] || "—"}
                                                        </span>
                                                    ) : col.key === "web_url" && lead[col.key] ? (
                                                        <a
                                                            href={lead[col.key]}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-orange-400 hover:text-orange-300 underline"
                                                        >
                                                            {lead[col.key]}
                                                        </a>
                                                    ) : (
                                                        lead[col.key] || "—"
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

        {/* Add Lead Generation modal — rendered via portal to escape any
            transformed ancestor that would otherwise break position:fixed */}
        {showFormModal && createPortal(
            (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black px-4 py-8 overflow-y-auto">
                    <div className="bg-black border border-orange-600/30 rounded-[32px] p-6 sm:p-8 lg:p-10 max-w-3xl w-full my-auto relative shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                        <button
                            type="button"
                            onClick={closeFormModal}
                            aria-label="Close"
                            className="absolute top-6 right-6 sm:top-8 sm:right-8 text-gray-400 hover:text-white transition duration-200"
                        >
                            <X size={22} />
                        </button>

                        <h3 className="font-bold text-2xl text-white">Add Lead Generation</h3>
                        <p className="text-gray-400 text-sm mt-2">
                            This feeds directly into your campaign's website form trigger.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field label="User Type" error={errors.user_type}>
                                    <SelectField
                                        id="user_type"
                                        value={form.user_type}
                                        onChange={handleChange("user_type")}
                                        options={userTypeOptions}
                                        hasError={!!errors.user_type}
                                    />
                                </Field>

                                <Field label="Country" error={errors.country}>
                                    <SelectField
                                        id="country"
                                        value={form.country}
                                        onChange={handleChange("country")}
                                        options={countryOptions}
                                        hasError={!!errors.country}
                                    />
                                </Field>

                                <Field label="User Name" error={errors.user_name} colSpan="md:col-span-2">
                                    <input
                                        id="user_name"
                                        type="text"
                                        placeholder="Enter the name"
                                        value={form.user_name}
                                        onChange={handleChange("user_name")}
                                        className={inputClasses(!!errors.user_name)}
                                    />
                                </Field>

                                <Field label="User Address">
                                    <textarea
                                        id="user_address"
                                        rows={3}
                                        placeholder="Enter address"
                                        value={form.user_address}
                                        onChange={handleChange("user_address")}
                                        className={inputClasses(false)}
                                    />
                                </Field>

                                <Field label="User GMB Status">
                                    <SelectField
                                        id="gmb_status"
                                        value={form.gmb_status}
                                        onChange={handleChange("gmb_status")}
                                        options={gmbStatusOptions}
                                        hasError={false}
                                    />
                                </Field>

                                <Field label="User Website" error={errors.web_url}>
                                    <input
                                        id="web_url"
                                        type="text"
                                        placeholder="Enter website"
                                        value={form.web_url}
                                        onChange={handleChange("web_url")}
                                        className={inputClasses(!!errors.web_url)}
                                    />
                                </Field>

                                <Field label="User Mobile Number" error={errors.user_num}>
                                    <input
                                        id="user_num"
                                        type="text"
                                        placeholder="Enter mobile number"
                                        value={form.user_num}
                                        onChange={handleChange("user_num")}
                                        className={inputClasses(!!errors.user_num)}
                                    />
                                </Field>

                                <Field label="User Email Id" error={errors.user_email}>
                                    <input
                                        id="user_email"
                                        type="text"
                                        placeholder="Enter email id"
                                        value={form.user_email}
                                        onChange={handleChange("user_email")}
                                        className={inputClasses(!!errors.user_email)}
                                    />
                                </Field>

                                <Field label="Prospects Assigned To">
                                    <SelectField
                                        id="assigned_prospect"
                                        value={form.assigned_prospect}
                                        onChange={handleChange("assigned_prospect")}
                                        options={assignedOptions}
                                        hasError={false}
                                    />
                                </Field>

                                <Field label="User Connected Date">
                                    <input
                                        id="connected_date"
                                        type="date"
                                        value={form.connected_date}
                                        onChange={handleChange("connected_date")}
                                        className={`${inputClasses(false)} [color-scheme:dark]`}
                                    />
                                </Field>

                                <Field label="Current Status">
                                    <SelectField
                                        id="current_status"
                                        value={form.current_status}
                                        onChange={handleChange("current_status")}
                                        options={statusOptions}
                                        hasError={false}
                                    />
                                </Field>

                                <Field label="Comment" colSpan="md:col-span-2">
                                    <textarea
                                        id="comment"
                                        rows={3}
                                        placeholder="Prospect comment"
                                        value={form.comment}
                                        onChange={handleChange("comment")}
                                        className={inputClasses(false)}
                                    />
                                </Field>
                            </div>

                            {errors.submit && (
                                <p className="text-center text-red-400 text-sm font-medium mt-8">{errors.submit}</p>
                            )}

                            <div className="flex items-center justify-center gap-4 mt-10">
                                <button
                                    type="button"
                                    onClick={closeFormModal}
                                    className="px-8 py-4 rounded-lg font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition duration-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-orange-500 hover:bg-orange-600 hover:shadow-[0_0_30px_rgba(249,115,22,0.35)] disabled:opacity-60 disabled:cursor-not-allowed text-white px-10 py-4 rounded-lg font-bold transition duration-300"
                                >
                                    {submitting ? "Submitting..." : "Submit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ),
            document.body
        )}

        {/* Success popup — also rendered via portal for the same reason */}
        {submitted && createPortal(
            (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black px-4">
                    <div className="bg-black border border-orange-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                        <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 border border-green-500/40 flex items-center justify-center">
                            <Check className="text-green-400" size={26} />
                        </div>
                        <h4 className="text-white font-bold text-xl mt-5">Successfully Submitted</h4>
                        <button
                            type="button"
                            onClick={() => setSubmitted(false)}
                            className="mt-7 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition duration-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ),
            document.body
        )}

        {/* Reachable Channels modal — opened by double-clicking a leads table row */}
        {channelsLead && createPortal(
            (
                <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4 py-6">
                    <div className="bg-black border border-orange-600/30 rounded-[28px] p-5 sm:p-6 max-w-xl w-full h-[85vh] max-h-[760px] flex flex-col relative shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div>
                                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Contact Lead</p>
                                <h3 className="text-white font-bold text-lg">{channelsLead.user_name || "Unnamed Lead"}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setChannelsLead(null)}
                                aria-label="Close"
                                className="text-gray-400 hover:text-white transition duration-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0">
                            <ReachableChannelsCard lead={channelsLead} />
                        </div>
                    </div>
                </div>
            ),
            document.body
        )}
        </>
    );
};

export default CampaignBuilderSection;