import { useState, useMemo, useEffect, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { entregaTurno } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import EntregaTurnoForm from './components/entregaTurno/EntregaTurnoForm';
import { fetchEntregarTurno, EntregarTurnoRow } from '@/stores/apiEntregarTurno';
import Swal from "sweetalert2";
import EntregaTurnoPdfExporterReactPdf from './components/entregaTurno/itemTables/EntregaTurnoPdfExporterReactPdf';
import EntregarTurnoDetalle from './components/entregaTurno/itemTables/EntregarTurnoDetalle';
import EntregarTurnoEditar from './components/entregaTurno/itemTables/EntregarTurnoEditar';

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

type Paginated<T> = {
    data: T[];
    links?: LaravelLink[];
    meta?: LaravelMeta;
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
function useDebounce<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);

    return debounced;
}
export default function EntregaTurno() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState("");
    const debouncedQ = useDebounce(q, 350);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<LaravelMeta | undefined>(undefined);
    const [rows, setRows] = useState<EntregarTurnoRow[]>([]);
    const { auth } = usePage<PageProps>().props;
    const [links, setLinks] = useState<LaravelLink[]>([]);
    const user = auth.user;
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [editarId, setEditarId] = useState<number | null>(null);
    const [detalleId, setDetalleId] = useState<number | null>(null);
    const [detalleOpen, setDetalleOpen] = useState(false);
    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        if (!user) {
            return [{ title: "Entregar Turno" }];
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
                    ? `Entregar Turno · ${roleName}`
                    : "Entregar Turno",
            },
        ];
    }, [user]);
    const [filters, setFilters] = useState({
        texto: "",
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
            const res = (await fetchEntregarTurno({
                q: nextQ,
                page: nextPage,
                ...filters,
            })) as Paginated<EntregarTurnoRow> | EntregarTurnoRow[];

            if (Array.isArray((res as any)?.data)) {
                const p = res as Paginated<EntregarTurnoRow>;
                setRows(p.data ?? []);
                setMeta(p.meta);
                setLinks(p.links ?? []);
            } else {
                setRows(res as EntregarTurnoRow[]);
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
    }, [debouncedQ, page]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="EntregaTurno" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 p-6 dark:border-sidebar-border md:min-h-min">
                    <div className="flex items-center justify-between pb-4">
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Gestión de turnos
                        </h1>
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
                            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm
                                transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                        >
                            Registrar Turno
                        </button>
                    </div>
                    <div className="p-4 text-sm text-gray-700 dark:text-gray-300">
                        {loading ? (
                            <div className="py-6 text-center text-gray-500">Cargando...</div>
                        ) : (
                            <table className="min-w-full border-collapse text-sm">
                                <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">#</th>
                                        <th className="px-3 py-2 text-left font-medium">Fecha</th>
                                        <th className="px-3 py-2 text-left font-medium">Nombre</th>
                                        <th className="px-3 py-2 text-left font-medium">Quien entrega</th>
                                        <th className="px-3 py-2 text-left font-medium">Jefe de turno</th>
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
                                            <td className="px-3 py-2">{row.nombre}</td>
                                            <td className="px-3 py-2">{row.nombre_quien_entrega ?? "-"}</td>
                                            <td className="px-3 py-2">{row.nombre_jefe_turno_despacho ?? "-"}</td>

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
                                                    {user?.isAdmin && (
                                                        <button
                                                            type="button"
                                                            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                            onClick={() => setEditarId(row.id)}
                                                            title="Editar"
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
                        )}
                    </div>
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="relative w-full max-w-9xl max-h-[98vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-y-auto p-6">
                        {/* Encabezado */}
                        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Registrar entrega de turno
                            </h2>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                        hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            >
                                <span className="text-lg leading-none">&times;</span>
                            </button>
                        </div>

                        {/* Contenido */}
                        <EntregaTurnoForm
                            onClose={() => setIsModalOpen(false)}
                            onSaved={() => {
                                setIsModalOpen(false);
                                setPage(1);
                                load({ page: 1 });
                            }}
                        />
                    </div>
                </div>
            )}
            {filtersOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-lg rounded-xl bg-white p-6 dark:bg-slate-900">
                        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Filtros de búsqueda
                        </h3>

                        <div className="grid gap-4">
                            {/* Texto general */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium">
                                    Nombre / Quién entrega / Jefe de turno
                                </label>
                                <input
                                    type="text"
                                    value={filters.texto}
                                    onChange={(e) =>
                                        setFilters({ ...filters, texto: e.target.value })
                                    }
                                    placeholder="Buscar por nombre"
                                    className="h-10 rounded-lg border px-3 dark:bg-slate-800 dark:border-slate-700"
                                />
                            </div>

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
                                        className="h-10 rounded-lg border px-3 dark:bg-slate-800 dark:border-slate-700"
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
                                        className="h-10 rounded-lg border px-3 dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Atajos */}
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={() =>
                                    setFilters({
                                        ...filters,
                                        fecha_inicio: new Date().toISOString().split("T")[0],
                                        fecha_fin: new Date().toISOString().split("T")[0],
                                    })
                                }
                                className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700"
                            >
                                Hoy
                            </button>

                            <button
                                onClick={() =>
                                    setFilters({
                                        texto: "",
                                        fecha_inicio: "",
                                        fecha_fin: "",
                                    })
                                }
                                className="rounded-full bg-gray-100 px-3 py-1 text-xs"
                            >
                                Limpiar
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
                                    setPage(1);
                                    load({ page: 1, q: filters.texto });
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
            <EntregaTurnoPdfExporterReactPdf
                id={pdfId}
                onDone={handlePdfDone}
            />
            {detalleOpen && detalleId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="relative w-full max-w-6xl max-h-[95vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-y-auto p-6">

                        {/* Header */}
                        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Detalle entrega de turno
                            </h2>

                            <button
                                type="button"
                                onClick={() => {
                                    setDetalleOpen(false);
                                    setDetalleId(null);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                    hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            >
                                <span className="text-lg leading-none">&times;</span>
                            </button>
                        </div>

                        {/* Contenido */}
                        <EntregarTurnoDetalle
                            id={detalleId}
                            onClose={() => {
                                setDetalleOpen(false);
                                setDetalleId(null);
                            }}
                            onSaved={() => {
                                setIsModalOpen(false);
                                setPage(1);
                                load({ page: 1 });
                            }}
                        />
                    </div>
                </div>
            )}
            {editarId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="relative w-full max-w-6xl max-h-[95vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-y-auto p-6">

                        <div className="mb-3 flex items-center justify-between border-b pb-2">
                            <h2 className="text-base font-semibold">Editar entrega de turno</h2>
                            <button onClick={() => setEditarId(null)}>×</button>
                        </div>

                        <EntregarTurnoEditar
                            id={editarId}
                            onClose={() => setEditarId(null)}
                            onSaved={() => {
                                setEditarId(null);
                                setPage(1);
                                load({ page: 1 });
                            }}
                        />
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
