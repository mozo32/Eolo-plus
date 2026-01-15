import { useEffect, useMemo, useState, useCallback } from "react";
import { usePage } from '@inertiajs/react';
import AppLayout from "@/layouts/app-layout";
import { walkAround } from "@/routes";
import { type BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import Swal from "sweetalert2";
import WalkAroundPdfExporter from "./components/walkAround/ItemTable/WalkAroundPdfExporter";
import WalkAroundForm from "./components/walkAround/WalkAroundForm";
import WalkAroundDetalleModal from "./components/walkAround/ItemTable/WalkAroundDetalleModal";
import WalkAroundEditarModal from "./components/walkAround/ItemTable/WalkAroundEditarModal";
import WalkAroundBitacora from "./components/walkAround/ItemTable/WalkAroundBitacora";
import { fetchWalkarounds, WalkAroundRow } from "@/stores/apiWalkaround";
import WalkAroundBasurero from "./components/walkAround/ItemTable/WalkAroundBasurero";
import WalkAroundFirmaModal from "./components/walkAround/ItemTable/WalkAroundFirmaModal";
type LaravelLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type LaravelMeta = {
    current_page: number;
    last_page: number;
    per_page?: number;
    total?: number;
};
type Role = {
    slug: string;
    nombre: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;

    isAdmin: boolean;
    roles: Role[];
};
type PageProps = {
    auth: {
        user: AuthUser | null;
    };
};
type Paginated<T> = {
    data: T[];
    links?: LaravelLink[];
    meta?: LaravelMeta;
};

function useDebounce<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);

    return debounced;
}

function normalizeLabel(label: string) {
    const clean = label
        .replace(/&laquo;|«/g, "")
        .replace(/&raquo;|»/g, "")
        .replace(/&amp;/g, "&")
        .trim();

    if (clean.toLowerCase().includes("previous")) return "←";
    if (clean.toLowerCase().includes("next")) return "→";
    return clean;
}

export default function WalkAround() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        if (!user) {
            return [{ title: "WalkAround" }];
        }

        const roleLabels: Record<string, string> = {
            admin: "Administrador",
            empleado: "Empleado",
            jefe_area: "Jefe de Área",
            fbo: "FBO",
        };

        const roleName =
            user.roles
                .map((r) => roleLabels[r.slug] ?? r.nombre)
                .join(", ");

        return [
            {
                title: roleName
                    ? `WalkAround · ${roleName}`
                    : "WalkAround",
            },
        ];
    }, [user]);
    const [rows, setRows] = useState<WalkAroundRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    // filtros + paginación
    const [q, setQ] = useState("");
    const debouncedQ = useDebounce(q, 350);
    const [page, setPage] = useState(1);

    const [meta, setMeta] = useState<LaravelMeta | undefined>(undefined);
    const [links, setLinks] = useState<LaravelLink[]>([]);
    const roleLabels2: Record<string, string> = {
        admin: "Administrador",
        empleado: "Empleado",
        jefe_area: "Jefe de Área",
        fbo: "FBO",
    };
    const userRol =
        user?.roles
            .map((r) => roleLabels2[r.slug] ?? r.nombre)
            .join(", ");

    // modal registrar
    const [isModalOpen, setIsModalOpen] = useState(false);

    // modal detalle
    const [detalleId, setDetalleId] = useState<number | null>(null);
    const [detalleOpen, setDetalleOpen] = useState(false);

    // modal editar
    const [editId, setEditId] = useState<number | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [firmId, setFirmId] = useState<number | null>(null);
    const [firmOpen, setFirmOpen] = useState(false);

    // modal basurero
    const [basuOpen, setBasuOpen] = useState(false);

    // modal bitacora
    const [bitacoraOpen, setBitacoraOpen] = useState(false);

    const [filters, setFilters] = useState({
        movimiento: "",
        tipo: "",
        fecha_inicio: "",
        fecha_fin: "",
    });
    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);
    const load = async (opts?: { q?: string; page?: number }) => {
        const nextQ = opts?.q ?? debouncedQ;
        const nextPage = opts?.page ?? page;

        setLoading(true);
        try {
            const res = (await fetchWalkarounds({
                q: nextQ,
                page: nextPage,
                ...filters,
            })) as Paginated<WalkAroundRow> | WalkAroundRow[];

            if (Array.isArray((res as any)?.data)) {
                const p = res as Paginated<WalkAroundRow>;
                setRows(p.data ?? []);
                setMeta(p.meta);
                setLinks(p.links ?? []);
            } else {
                setRows(res as WalkAroundRow[]);
                setMeta(undefined);
                setLinks([]);
            }
        } catch (e: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: e?.message || "No se pudo cargar la información",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load({ q: debouncedQ, page });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ, page]);

    // si cambia filtro, vuelve a página 1
    useEffect(() => {
        setPage(1);
    }, [debouncedQ]);

    const pageLabel = useMemo(() => {
        if (!meta) return null;
        return `Página ${meta.current_page} de ${meta.last_page}${meta.total ? ` · ${meta.total} registros` : ""
            }`;
    }, [meta]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="WalkAround" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="relative flex-1 rounded-xl border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Gestión de WalkAround
                            </h1>

                            {pageLabel && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{pageLabel}</p>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Buscar (matrícula, destino, movimiento...)"
                                className="h-10 w-72 max-w-full rounded-lg border border-gray-300 bg-white px-3 text-sm
                                outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                            <button
                                onClick={() => setFiltersOpen(true)}
                                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
                                hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                                    stroke="currentColor" strokeWidth="2">
                                    <path d="M4 6h16M7 12h10M10 18h4" />
                                </svg>
                                Filtros
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                            >
                                Registrar WalkAround
                            </button>
                            {user?.isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setBasuOpen(true)}

                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#ff2d55"
                                        stroke-width="1"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path d="M4 7l16 0" />
                                        <path d="M10 11l0 6" />
                                        <path d="M14 11l0 6" />
                                        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                                        <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                                    </svg>
                                </button>
                            )}
                            {user?.isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setBitacoraOpen(true)}

                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#4cd964"
                                        stroke-width="1"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path d="M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z" />
                                        <path d="M10 16h6" />
                                        <path d="M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                                        <path d="M4 8h3" />
                                        <path d="M4 12h3" />
                                        <path d="M4 16h3" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabla */}
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                        {loading ? (
                            <div className="py-6 text-center text-gray-500">Cargando...</div>
                        ) : (
                            <>
                                <table className="min-w-full border-collapse">
                                    <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">#</th>
                                            <th className="px-3 py-2 text-left font-medium">Fecha</th>
                                            <th className="px-3 py-2 text-left font-medium">Movimiento</th>
                                            <th className="px-3 py-2 text-left font-medium">Matrícula</th>
                                            <th className="px-3 py-2 text-left font-medium">Procedencia</th>
                                            <th className="px-3 py-2 text-left font-medium">Destino</th>
                                            <th className="px-3 py-2 text-center font-medium">Opciones</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {rows.map((row) => (
                                            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                                <td className="px-3 py-2">{row.id}</td>
                                                <td className="px-3 py-2">
                                                    {row.fecha ? String(row.fecha).split("T")[0] : "-"}
                                                </td>
                                                <td className="px-3 py-2 flex items-center gap-2">
                                                    {row.movimiento === "salida" && (
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="20"
                                                            height="20"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="#ff3b30"
                                                            strokeWidth="1"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <path d="M17 11v6l-5 -4l-5 4v-6l5 -4z" />
                                                        </svg>
                                                    )}

                                                    {row.movimiento === "entrada" && (
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="20"
                                                            height="20"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="#4cd964"
                                                            strokeWidth="1"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <path d="M17 13v-6l-5 4l-5 -4v6l5 4z" />
                                                        </svg>
                                                    )}

                                                    <span className="capitalize">{row.movimiento}</span>
                                                </td>
                                                <td className="px-3 py-2">{row.matricula}</td>
                                                <td className="px-3 py-2">{row.procedensia ?? "-"}</td>
                                                <td className="px-3 py-2">{row.destino ?? "-"}</td>

                                                {/* Opciones */}
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {/* Ver detalle */}
                                                        <button
                                                            type="button"
                                                            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                            title="Ver detalle"
                                                            onClick={() => {
                                                                setDetalleId(row.id);
                                                                setDetalleOpen(true);
                                                            }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#76c69d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0">
                                                            </path><circle cx="12" cy="12" r="3"></circle>
                                                            </svg>
                                                        </button>
                                                        {userRol == 'FBO' || userRol == 'Jefe de Área' && (
                                                            <button
                                                                type="button"
                                                                className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                                title="Firmar"
                                                                onClick={() => {
                                                                    setFirmId(row.id);
                                                                    setFirmOpen(true);
                                                                }}
                                                            >
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    width="32"
                                                                    height="32"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="#5856d6"
                                                                    stroke-width="1"
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                >
                                                                    <path d="M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2" />
                                                                </svg>
                                                            </button>
                                                        )}

                                                        {user?.isAdmin || userRol == 'Jefe de Área' && (
                                                            <button
                                                                type="button"
                                                                className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                                title="Editar"
                                                                onClick={() => {
                                                                    setEditId(row.id);
                                                                    setEditOpen(true);
                                                                }}
                                                            >
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    width="24"
                                                                    height="24"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="#426587"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13" />
                                                                    <path d="m8 6 2-2" />
                                                                    <path d="m18 16 2-2" />
                                                                    <path d="m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17" />
                                                                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                                                                    <path d="m15 5 4 4" />
                                                                </svg>
                                                            </button>
                                                        )}

                                                        {/* Exportar PDF */}
                                                        <button
                                                            type="button"
                                                            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                            title="Exportar PDF"
                                                            onClick={() => {
                                                                setPdfId(row.id);
                                                            }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                                                fill="none" stroke="#c0841a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                <path d="M7 10l5 5 5-5" />
                                                                <path d="M12 15V3" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {!rows.length && (
                                            <tr>
                                                <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                                                    Sin registros
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Paginación */}
                                {!!links.length && (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {meta?.per_page ? `Mostrando ${meta.per_page} por página` : null}
                                        </div>

                                        <div className="flex flex-wrap justify-end gap-1">
                                            {links.map((l, idx) => {
                                                const label = normalizeLabel(l.label);
                                                return (
                                                    <button
                                                        key={`${label}-${idx}`}
                                                        type="button"
                                                        disabled={!l.url}
                                                        onClick={() => {
                                                            if (!l.url) return;
                                                            const u = new URL(l.url, window.location.origin);
                                                            setPage(Number(u.searchParams.get("page") || 1));
                                                        }}
                                                        className={[
                                                            "rounded-md border px-3 py-2 text-xs font-semibold transition",
                                                            l.active
                                                                ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                                                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800",
                                                        ].join(" ")}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal detalle */}
            <WalkAroundDetalleModal
                open={detalleOpen}
                id={detalleId}
                onClose={() => {
                    setDetalleOpen(false);
                    setDetalleId(null);
                }}
                onChanged={() => load({ q: debouncedQ, page })}
            />

            {/* Modal editar */}
            <WalkAroundEditarModal
                open={editOpen}
                id={editId}
                onClose={() => {
                    setEditOpen(false);
                    setEditId(null);
                }}
                onSaved={() => load({ q: debouncedQ, page })}
            />
            {/* Modal firma */}
            <WalkAroundFirmaModal
                open={firmOpen}
                id={firmId}
                onClose={() => {
                    setFirmOpen(false);
                    setFirmId(null);
                }}
                onSaved={() => load({ q: debouncedQ, page })}
            />
            <WalkAroundBasurero
                open={basuOpen}
                onClose={() => {
                    setBasuOpen(false);
                }}
                onActivated={() => {
                    load({ q: debouncedQ, page });
                    setBasuOpen(false);
                }}
            />
            <WalkAroundBitacora
                open={bitacoraOpen}
                onClose={() => {
                    setBitacoraOpen(false);
                }}
            />
            {filtersOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-lg rounded-xl bg-white p-6 dark:bg-slate-900">
                        <h3 className="mb-4 text-lg font-semibold">Filtros avanzados</h3>

                        <div className="grid gap-4">
                            {/* Movimiento */}
                            <select
                                value={filters.movimiento}
                                onChange={(e) => setFilters({ ...filters, movimiento: e.target.value })}
                                className="h-10 rounded-lg border px-3"
                            >
                                <option value="">Todos los movimientos</option>
                                <option value="entrada">Entrada</option>
                                <option value="salida">Salida</option>
                            </select>

                            {/* Tipo */}
                            <select
                                value={filters.tipo}
                                onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
                                className="h-10 rounded-lg border px-3"
                            >
                                <option value="">Todos los tipos</option>
                                <option value="avion">Avión</option>
                                <option value="helicoptero">Helicóptero</option>
                            </select>

                            {/* Fechas */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium">Desde</label>
                                    <input
                                        type="date"
                                        value={filters.fecha_inicio}
                                        onChange={(e) =>
                                            setFilters({ ...filters, fecha_inicio: e.target.value })
                                        }
                                        className="h-10 rounded-lg border px-3"
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium">Hasta</label>
                                    <input
                                        type="date"
                                        value={filters.fecha_fin}
                                        onChange={(e) =>
                                            setFilters({ ...filters, fecha_fin: e.target.value })
                                        }
                                        className="h-10 rounded-lg border px-3"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Atajos */}
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilters({ ...filters, movimiento: "entrada" })}
                                className="rounded-full bg-green-100 px-3 py-1 text-xs"
                            >
                                Solo entradas
                            </button>

                            <button
                                onClick={() => setFilters({ ...filters, movimiento: "salida" })}
                                className="rounded-full bg-red-100 px-3 py-1 text-xs"
                            >
                                Solo salidas
                            </button>

                            <button
                                onClick={() =>
                                    setFilters({
                                        ...filters,
                                        fecha_inicio: new Date().toISOString().split("T")[0],
                                        fecha_fin: new Date().toISOString().split("T")[0],
                                    })
                                }
                                className="rounded-full bg-blue-100 px-3 py-1 text-xs"
                            >
                                Hoy
                            </button>
                        </div>

                        {/* Acciones */}
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                onClick={() => setFiltersOpen(false)}
                                className="rounded-lg px-4 py-2 text-sm"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={() => {
                                    load({ page: 1, q: debouncedQ });
                                    setFiltersOpen(false);
                                }}
                                className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
                            >
                                Aplicar filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal registrar */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-7xl max-h-[95vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-200 pb-2 dark:border-gray-700">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Registrar WalkAround
                            </h2>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                                hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            >
                                ✕
                            </button>
                        </div>

                        {isModalOpen && (
                            <WalkAroundForm
                                key={isModalOpen ? "open" : "closed"}
                                open={isModalOpen}
                                onClose={() => setIsModalOpen(false)}
                                onSaved={async () => {
                                    setIsModalOpen(false);
                                    await load({ q: debouncedQ, page });
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
            <WalkAroundPdfExporter
                id={pdfId}
                onDone={handlePdfDone}
            />
        </AppLayout>
    );
}
