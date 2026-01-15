import { useEffect, useState } from "react";
import type { WalkAroundBitacora as BitacoraItem } from "@/stores/apiWalkaround";

type Props = {
    open: boolean;
    onClose: () => void;
};

/* =======================
   API
======================= */
async function fetchWalkaroundBitacora(params: {
    page?: number;
    desde?: string;
    hasta?: string;
    accion?: string;
    q?: string;
}) {
    const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as any
    );

    const res = await fetch(`/api/walkarounds/bitacora?${qs.toString()}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error("No se pudo cargar la bitácora");
    return data;
}

/* =======================
   COMPONENT
======================= */
export default function WalkAroundBitacora({ open, onClose }: Props) {
    const [rows, setRows] = useState<BitacoraItem[]>([]);
    const [loading, setLoading] = useState(false);

    // filtros
    const [q, setQ] = useState("");
    const [accion, setAccion] = useState("");
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");

    // paginación
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    // detalle
    const [detalle, setDetalle] = useState<BitacoraItem | null>(null);

    useEffect(() => {
        if (!open) return;

        const load = async () => {
            setLoading(true);
            try {
                const res = await fetchWalkaroundBitacora({
                    page,
                    q,
                    accion,
                    desde,
                    hasta,
                });

                setRows(res.data ?? []);
                setLastPage(res.last_page ?? 1);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [open, page, q, accion, desde, hasta]);

    if (!open) return null;

    const accionColor = (a?: string) => {
        switch (a) {
            case "Crear":
                return "bg-green-600";
            case "Actualizar":
                return "bg-blue-600";
            case "Eliminar":
                return "bg-red-600";
            case "Activar":
                return "bg-purple-600";
            default:
                return "bg-gray-500";
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
            <div className="relative w-full max-w-7xl rounded-xl bg-white dark:bg-slate-900 shadow-2xl max-h-[95vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Bitácora WalkAround
                        </h2>
                        <p className="text-xs text-gray-500">
                            Registro de acciones del sistema
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Filtros */}
                <div className="px-6 py-4 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <input
                            type="text"
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setPage(1); }}
                            placeholder="Buscar..."
                            className="md:col-span-2 rounded border px-3 py-2 text-sm dark:bg-gray-900"
                        />

                        <select
                            value={accion}
                            onChange={(e) => { setAccion(e.target.value); setPage(1); }}
                            className="rounded border px-3 py-2 text-sm dark:bg-gray-900"
                        >
                            <option value="">Todas</option>
                            <option value="CREAR">CREAR</option>
                            <option value="ACTUALIZAR">ACTUALIZAR</option>
                            <option value="ELIMINAR">ELIMINAR</option>
                            <option value="ACTIVAR">ACTIVAR</option>
                        </select>

                        <input
                            type="date"
                            value={desde}
                            onChange={(e) => { setDesde(e.target.value); setPage(1); }}
                            className="rounded border px-3 py-2 text-sm dark:bg-gray-900"
                        />

                        <input
                            type="date"
                            value={hasta}
                            onChange={(e) => { setHasta(e.target.value); setPage(1); }}
                            className="rounded border px-3 py-2 text-sm dark:bg-gray-900"
                        />

                        <button
                            onClick={() => {
                                setQ(""); setAccion(""); setDesde(""); setHasta(""); setPage(1);
                            }}
                            className="rounded border px-3 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>

                {/* Tabla */}
                <div className="overflow-auto">
                    {loading ? (
                        <div className="py-20 text-center text-sm text-gray-500">
                            Cargando bitácora...
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left">Fecha</th>
                                    <th className="px-4 py-3">Hora</th>
                                    <th className="px-4 py-3">Módulo</th>
                                    <th className="px-4 py-3">Acción</th>
                                    <th className="px-4 py-3 text-left">Descripción</th>
                                    <th className="px-4 py-3">Usuario</th>
                                    <th className="px-4 py-3">Detalle</th>
                                </tr>
                            </thead>

                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-10 text-center text-gray-500">
                                            Sin registros
                                        </td>
                                    </tr>
                                )}

                                {rows.map((b, i) => (
                                    <tr
                                        key={b.id}
                                        className={`border-t dark:border-gray-700 ${
                                            i % 2 === 0
                                                ? "bg-white dark:bg-slate-900"
                                                : "bg-gray-50 dark:bg-gray-800"
                                        }`}
                                    >
                                        <td className="px-4 py-2">{b.fecha?.split("T")[0]}</td>
                                        <td className="px-4 py-2 text-center">{b.hora ?? "-"}</td>
                                        <td className="px-4 py-2 font-semibold">{b.modulo}</td>
                                        <td className="px-4 py-2 text-center">
                                            <span className={`px-2 py-1 text-xs rounded text-white ${accionColor(b.accion ?? undefined)}`}>
                                                {b.accion}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">{b.descripcion ?? "-"}</td>
                                        <td className="px-4 py-2">{b.elabora ?? "-"}</td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={() => setDetalle(b)}
                                                className="text-blue-600 text-xs font-semibold hover:underline"
                                            >
                                                Ver
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between px-6 py-4 border-t dark:border-gray-700">
                    <span className="text-sm text-gray-500">
                        Página {page} de {lastPage}
                    </span>

                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                        >
                            ← Anterior
                        </button>
                        <button
                            disabled={page >= lastPage}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                        >
                            Siguiente →
                        </button>
                    </div>
                </div>

                {/* Modal detalle */}
                {detalle && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-lg">
                            <h3 className="font-semibold mb-2">Detalle bitácora</h3>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-80">
                                {JSON.stringify(detalle, null, 2)}
                            </pre>
                            <div className="mt-4 text-right">
                                <button
                                    onClick={() => setDetalle(null)}
                                    className="rounded border px-4 py-2 text-sm"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
