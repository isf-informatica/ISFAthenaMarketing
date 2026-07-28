import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Package,
    Plus,
    X,
    Loader2,
    ChevronDown,
    Code2,
    ShoppingCart,
    GraduationCap,
    HeartPulse,
    Landmark,
    Factory,
    Store,
    Plane,
    Car,
    Gavel,
    Megaphone,
    Building2,
    Pencil,
    MoreVertical,
    BarChart3,
    ArrowUpRight,
} from "lucide-react";
import Starfield from "./Starfield";
import Sidebar from "./DashboardSidebar";

/* ==========================================================
   PRODUCTS PAGE — full product list + add/edit CRUD, split
   out of Home.jsx so product management has its own route
   (sidebar "Products" link points here). Same
   isfathena.products API and fields as before.
========================================================== */

const API_BASE_URL = "http://localhost:8000";
const PRODUCTS_ENDPOINT = `${API_BASE_URL}/products`;

const formatPrice = (num) => {
    const n = Number(num) || 0;
    return `₹${n.toLocaleString("en-IN")}`;
};

const OTHER = "Other (specify)";

const CATEGORY_OPTIONS = [
    "Real Estate",
    "SaaS / Software",
    "E-commerce",
    "Education",
    "Healthcare",
    "Finance & Banking",
    "Manufacturing",
    "Retail",
    "Hospitality & Travel",
    "Automotive",
    "Legal Services",
    "Marketing & Advertising",
    OTHER,
];

const CATEGORY_ICONS = {
    "Real Estate": Building2,
    "SaaS / Software": Code2,
    "E-commerce": ShoppingCart,
    Education: GraduationCap,
    Healthcare: HeartPulse,
    "Finance & Banking": Landmark,
    Manufacturing: Factory,
    Retail: Store,
    "Hospitality & Travel": Plane,
    Automotive: Car,
    "Legal Services": Gavel,
    "Marketing & Advertising": Megaphone,
};
const categoryIcon = (category) => CATEGORY_ICONS[category] || Package;

const LOCATION_OPTIONS = [
    "Mumbai, India",
    "Delhi NCR, India",
    "Bangalore, India",
    "Pune, India",
    "Hyderabad, India",
    "Chennai, India",
    "Ahmedabad, India",
    "Nashik, India",
    "Pan India",
    "International",
    OTHER,
];

const KEYWORD_OPTIONS = [
    "CRM software",
    "Sales automation",
    "Lead management",
    "Marketing automation",
    "WhatsApp marketing",
    "Email marketing",
    "Digital marketing services",
    "Business consulting",
    OTHER,
];

const AUDIENCE_OPTIONS = [
    "Small business owners",
    "Startups",
    "Enterprise companies",
    "Individual consumers",
    "Students",
    "Working professionals",
    "Freelancers",
    "Government / Public sector",
    "Non-profit organizations",
    OTHER,
];

const emptyForm = {
    product_name: "",
    description: "",
    price: "",
    image_url: "",
    category: "",
    target_keywords: "",
    target_location: "",
    target_audience: "",
};

/* ---------- presentational pieces ---------- */

const ProductCard = ({ product, onEdit, onManage, onAnalytics }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const onDocClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const CatIcon = categoryIcon(product.category);
    const billingCycle = product.billing_cycle || "Monthly";
    const status = product.status || "Active";

    return (
        <div
            onClick={onManage}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onManage?.();
            }}
            className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-orange-500/50 hover:shadow-[0_0_0_1px_rgba(255,107,0,0.25),0_20px_50px_-20px_rgba(255,107,0,0.35)]"
        >
            <div className="relative h-36 w-full shrink-0 overflow-hidden bg-white/[0.03]">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <CatIcon size={30} className="text-zinc-700" />
                    </div>
                )}

                {product.category && (
                    <span className="absolute left-3 top-3 rounded-full border border-orange-500/30 bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-orange-300 backdrop-blur-sm">
                        {product.category}
                    </span>
                )}

                <div ref={menuRef} className="absolute right-2.5 top-2.5">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen((v) => !v);
                        }}
                        aria-label="Product options"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/70 text-zinc-300 backdrop-blur-sm transition hover:border-orange-500/50 hover:text-white"
                    >
                        <MoreVertical size={14} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] py-1 shadow-xl">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onEdit?.(e);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
                            >
                                <Pencil size={12} /> Edit product
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onAnalytics?.(product);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
                            >
                                <BarChart3 size={12} /> View analytics
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-white">{product.product_name}</h3>
                    <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            status === "Active"
                                ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                : "border border-zinc-500/25 bg-zinc-500/10 text-zinc-400"
                        }`}
                    >
                        {status}
                    </span>
                </div>

                {product.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">{product.description}</p>
                )}

                <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold text-orange-400">{formatPrice(product.price)}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                        /{billingCycle.toLowerCase() === "yearly" ? "year" : "month"}
                    </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onManage?.();
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300"
                    >
                        Manage
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAnalytics?.(product);
                        }}
                        aria-label="View analytics"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300"
                    >
                        <ArrowUpRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ---------------------------- main component ---------------------------- */

const Products = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [customFields, setCustomFields] = useState({
        category: false,
        target_location: false,
        target_keywords: false,
        target_audience: false,
    });
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const authHeaders = () => {
        const token = localStorage.getItem("growthos_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchProducts = async () => {
        setProductsLoading(true);
        try {
            const res = await fetch(PRODUCTS_ENDPOINT, { method: "GET", headers: authHeaders() });
            if (res.status === 401) {
                navigate("/login");
                return;
            }
            const resp = await res.json();
            setProducts(res.ok && resp.success && Array.isArray(resp.data) ? resp.data : []);
        } catch (err) {
            setProducts([]);
        } finally {
            setProductsLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem("growthos_token")) {
            navigate("/login");
            return;
        }
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // If we arrived here via ?add=1 (e.g. a "Add Product" quick action
    // elsewhere in the app), open the modal automatically.
    useEffect(() => {
        if (searchParams.get("add") === "1") openAddModal();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const selectOrCustom = (field) => (e) => {
        const value = e.target.value;
        if (value === OTHER) {
            setCustomFields((c) => ({ ...c, [field]: true }));
            setForm((f) => ({ ...f, [field]: "" }));
        } else {
            setCustomFields((c) => ({ ...c, [field]: false }));
            setForm((f) => ({ ...f, [field]: value }));
        }
    };

    const openAddModal = () => {
        setEditingProduct(null);
        setForm(emptyForm);
        setCustomFields({ category: false, target_location: false, target_keywords: false, target_audience: false });
        setFormError("");
        setModalOpen(true);
    };

    const openEditModal = (p) => (e) => {
        e?.stopPropagation();
        setEditingProduct(p);
        setForm({
            product_name: p.product_name || "",
            description: p.description || "",
            price: p.price != null ? String(p.price) : "",
            image_url: p.image_url || "",
            category: p.category || "",
            target_keywords: p.target_keywords || "",
            target_location: p.target_location || "",
            target_audience: p.target_audience || "",
        });
        setCustomFields({
            category: !!p.category && !CATEGORY_OPTIONS.includes(p.category),
            target_location: !!p.target_location && !LOCATION_OPTIONS.includes(p.target_location),
            target_keywords: !!p.target_keywords && !KEYWORD_OPTIONS.includes(p.target_keywords),
            target_audience: !!p.target_audience && !AUDIENCE_OPTIONS.includes(p.target_audience),
        });
        setFormError("");
        setModalOpen(true);
    };

    const handleSubmitProduct = async (e) => {
        e.preventDefault();
        if (!form.product_name.trim()) return setFormError("Product name is required.");
        if (!form.description.trim()) return setFormError("Description is required.");
        if (!form.price || Number(form.price) <= 0) return setFormError("Enter a valid price.");
        if (!form.category.trim()) return setFormError("Category / Industry is required.");
        if (!form.target_location.trim()) return setFormError("Target Location is required.");
        if (!form.target_keywords.trim()) return setFormError("Target Keywords is required.");
        if (!form.target_audience.trim()) return setFormError("Target Audience is required.");

        setSaving(true);
        setFormError("");
        try {
            const isEditing = !!editingProduct;
            const res = await fetch(
                isEditing ? `${PRODUCTS_ENDPOINT}/${editingProduct.id}` : PRODUCTS_ENDPOINT,
                {
                    method: isEditing ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({
                        product_name: form.product_name.trim(),
                        description: form.description.trim(),
                        price: Number(form.price) || 0,
                        image_url: form.image_url.trim(),
                        category: form.category.trim(),
                        target_keywords: form.target_keywords.trim(),
                        target_location: form.target_location.trim(),
                        target_audience: form.target_audience.trim(),
                    }),
                }
            );
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) {
                console.error("Product save failed:", res.status, resp);
                throw new Error(resp?.message || `Request failed (${res.status})`);
            }
            setModalOpen(false);
            setEditingProduct(null);
            setForm(emptyForm);
            fetchProducts();
        } catch (err) {
            console.error("Product save error:", err);
            setFormError(err.message || `Could not ${editingProduct ? "update" : "save"} this product. Please try again.`);
        } finally {
            setSaving(false);
        }
    };

    const openPricing = (p) => {
        localStorage.setItem("growthos_active_product_id", String(p.id));
        navigate(`/pricing?product=${p.id}`);
    };

    const openAnalytics = (p) => {
        navigate(`/analytics?product=${p.id}`);
    };

    return (
        <div className="relative min-h-screen w-full bg-[#050505] text-zinc-300">
            <Sidebar />

            <div className="relative min-h-screen w-full overflow-hidden lg:pl-64">
                <Starfield />

                <div className="relative z-10 w-full space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white sm:text-3xl">
                                <Package size={22} className="text-orange-500" /> Products
                            </h1>
                            <p className="mt-1 text-sm text-zinc-500">Manage and monitor all your products</p>
                        </div>
                        <button
                            type="button"
                            onClick={openAddModal}
                            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
                        >
                            <Plus size={16} /> Add Product
                        </button>
                    </div>

                    {productsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                            <Loader2 size={14} className="animate-spin" /> Loading products...
                        </div>
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-[24px] border border-dashed border-orange-600/30 py-14">
                            <Package size={28} className="text-zinc-600" />
                            <p className="text-sm text-zinc-500">No products yet — click "Add Product" to add your first one.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                            {products.map((p) => (
                                <ProductCard
                                    key={p.id}
                                    product={p}
                                    onEdit={openEditModal(p)}
                                    onManage={() => openPricing(p)}
                                    onAnalytics={openAnalytics}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Product modal */}
            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
                    onClick={() => { setModalOpen(false); setEditingProduct(null); }}
                >
                    <div
                        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-orange-600/30 bg-[#0a0a0a] p-6 sm:p-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => { setModalOpen(false); setEditingProduct(null); }}
                            className="absolute right-5 top-5 text-zinc-500 transition hover:text-white"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="shrink-0 text-xl font-bold text-white">{editingProduct ? "Edit Product" : "Add Product"}</h2>

                        <form onSubmit={handleSubmitProduct} className="mt-5 flex min-h-0 flex-1 flex-col">
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Product Name <span className="text-orange-500">*</span></label>
                                    <input
                                        type="text"
                                        value={form.product_name}
                                        onChange={update("product_name")}
                                        placeholder="e.g. GrowthOS AI CRM"
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Description <span className="text-orange-500">*</span></label>
                                    <textarea
                                        value={form.description}
                                        onChange={update("description")}
                                        rows={2}
                                        placeholder="Short description..."
                                        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Price (₹) <span className="text-orange-500">*</span></label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.price}
                                            onChange={update("price")}
                                            placeholder="0"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Image URL <span className="text-zinc-600">(optional)</span></label>
                                        <input
                                            type="text"
                                            value={form.image_url}
                                            onChange={update("image_url")}
                                            placeholder="https://..."
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">Lead Targeting</p>
                                    <p className="mb-3 mt-1 text-[11px] text-zinc-500">
                                        Used later to find leads for this product from an external source — that integration isn't
                                        connected yet, this just saves your targeting info for when it is.
                                    </p>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Category / Industry <span className="text-orange-500">*</span></label>
                                                <div className="relative">
                                                    <select
                                                        value={customFields.category ? OTHER : form.category}
                                                        onChange={selectOrCustom("category")}
                                                        className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-8 text-sm text-white outline-none transition focus:border-orange-600/50"
                                                    >
                                                        <option value="" className="bg-[#0a0a0a]">Select...</option>
                                                        {CATEGORY_OPTIONS.map((opt) => (
                                                            <option key={opt} value={opt} className="bg-[#0a0a0a]">{opt}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                                </div>
                                                {customFields.category && (
                                                    <input
                                                        type="text"
                                                        value={form.category}
                                                        onChange={update("category")}
                                                        placeholder="Type your industry"
                                                        autoFocus
                                                        className="mt-2 w-full rounded-lg border border-orange-600/40 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition"
                                                    />
                                                )}
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Target Location <span className="text-orange-500">*</span></label>
                                                <div className="relative">
                                                    <select
                                                        value={customFields.target_location ? OTHER : form.target_location}
                                                        onChange={selectOrCustom("target_location")}
                                                        className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-8 text-sm text-white outline-none transition focus:border-orange-600/50"
                                                    >
                                                        <option value="" className="bg-[#0a0a0a]">Select...</option>
                                                        {LOCATION_OPTIONS.map((opt) => (
                                                            <option key={opt} value={opt} className="bg-[#0a0a0a]">{opt}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                                </div>
                                                {customFields.target_location && (
                                                    <input
                                                        type="text"
                                                        value={form.target_location}
                                                        onChange={update("target_location")}
                                                        placeholder="Type a location"
                                                        autoFocus
                                                        className="mt-2 w-full rounded-lg border border-orange-600/40 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Target Keywords <span className="text-orange-500">*</span></label>
                                            <div className="relative">
                                                <select
                                                    value={customFields.target_keywords ? OTHER : form.target_keywords}
                                                    onChange={selectOrCustom("target_keywords")}
                                                    className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-8 text-sm text-white outline-none transition focus:border-orange-600/50"
                                                >
                                                    <option value="" className="bg-[#0a0a0a]">Select...</option>
                                                    {KEYWORD_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt} className="bg-[#0a0a0a]">{opt}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                            </div>
                                            {customFields.target_keywords ? (
                                                <input
                                                    type="text"
                                                    value={form.target_keywords}
                                                    onChange={update("target_keywords")}
                                                    placeholder="e.g. crm software, sales automation, lead management"
                                                    autoFocus
                                                    className="mt-2 w-full rounded-lg border border-orange-600/40 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition"
                                                />
                                            ) : (
                                                <p className="mt-1 text-[10px] text-zinc-600">Pick the closest match, or choose "{OTHER}" to type your own.</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Target Audience <span className="text-orange-500">*</span></label>
                                            <div className="relative">
                                                <select
                                                    value={customFields.target_audience ? OTHER : form.target_audience}
                                                    onChange={selectOrCustom("target_audience")}
                                                    className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-8 text-sm text-white outline-none transition focus:border-orange-600/50"
                                                >
                                                    <option value="" className="bg-[#0a0a0a]">Select...</option>
                                                    {AUDIENCE_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt} className="bg-[#0a0a0a]">{opt}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                            </div>
                                            {customFields.target_audience && (
                                                <input
                                                    type="text"
                                                    value={form.target_audience}
                                                    onChange={update("target_audience")}
                                                    placeholder="Type your target audience"
                                                    autoFocus
                                                    className="mt-2 w-full rounded-lg border border-orange-600/40 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {formError && <p className="mt-3 shrink-0 text-xs text-red-400">{formError}</p>}

                            <div className="flex shrink-0 justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => { setModalOpen(false); setEditingProduct(null); }}
                                    disabled={saving}
                                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                                >
                                    {saving ? "Saving..." : editingProduct ? "Save Changes" : "Add Product"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;