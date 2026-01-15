import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import Swal from "sweetalert2";
import {
    WalkAroundDetalle,
    fetchWalkaroundDetalle,
    deleteWalkaround,
} from "@/stores/apiWalkaround";
import MapaDanios3D from "../MapaDanios3D";

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

type Props = {
    id: number | null;
    open: boolean;
    onClose: () => void;
    onChanged?: () => void;
};

function formatDanioLabel(v: string) {
    switch (v) {
        case "sin_danio": return "Sin daño";
        case "golpe": return "Golpe";
        case "rayon": return "Rayón";
        case "fisurado": return "Fisurado";
        case "quebrado": return "Quebrado";
        case "pintura_cuarteada": return "Pintura cuarteada";
        case "otro": return "Otro";
        default: return v;
    }
}

function DaniosBadges({ v }: { v: unknown }) {
    let danios: string[] = [];
    let izq = false;
    let der = false;

    if (Array.isArray(v)) {
        danios = v;
    } else if (typeof v === "object" && v !== null) {
        const obj = v as any;
        danios = Array.isArray(obj.danios) ? obj.danios : [];
        izq = !!obj.izq;
        der = !!obj.der;
    }

    if (!danios.length) {
        return <span className="text-sm italic text-gray-400">Pendiente</span>;
    }

    if (danios.includes("sin_danio")) {
        return (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Sin daño
            </span>
        );
    }

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
                {danios.map((d) => (
                    <span
                        key={d}
                        className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    >
                        {formatDanioLabel(d)}
                    </span>
                ))}
            </div>
            {(izq || der) && (
                <div className="text-[10px] text-gray-500">
                    {izq && "IZQ "}
                    {der && "DER"}
                </div>
            )}
        </div>
    );
}

function clasificarChecklist(data: Record<string, unknown>) {
    const ok: [string, unknown][] = [];
    const conDanio: [string, unknown][] = [];
    const pendiente: [string, unknown][] = [];

    Object.entries(data).forEach(([k, v]) => {
        if (!v) {
            pendiente.push([k, v]);
            return;
        }

        if (Array.isArray(v) && v.includes("sin_danio")) {
            ok.push([k, v]);
            return;
        }

        if (typeof v === "object" && v !== null) {
            const d = (v as any).danios;
            if (Array.isArray(d) && d.includes("sin_danio")) {
                ok.push([k, v]);
            } else if (Array.isArray(d) && d.length) {
                conDanio.push([k, v]);
            } else {
                pendiente.push([k, v]);
            }
            return;
        }

        pendiente.push([k, v]);
    });

    return { ok, conDanio, pendiente };
}

export default function WalkAroundDetalleModal({
    id,
    open,
    onClose,
    onChanged,
}: Props) {
    const [detalle, setDetalle] = useState<WalkAroundDetalle | null>(null);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<"danio" | "ok" | "pendiente">("danio");

    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    useEffect(() => {
        if (!open || id == null) return;

        (async () => {
            setLoading(true);
            try {
                const data = await fetchWalkaroundDetalle(id);
                setDetalle(data);
            } catch {
                Swal.fire("Error", "No se pudo cargar el detalle", "error");
                onClose();
            } finally {
                setLoading(false);
            }
        })();
    }, [open, id]);

    const handleDelete = async () => {
        if (!id) return;

        const r = await Swal.fire({
            icon: "warning",
            title: "¿Eliminar registro?",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            confirmButtonText: "Eliminar",
        });

        if (!r.isConfirmed) return;

        await deleteWalkaround(id);
        Swal.fire("Eliminado", `Registro #${id}`, "success");
        onClose();
        onChanged?.();
    };

    const checklistActual = useMemo(() => {
        const cl = detalle?.checklists;
        if (!cl) return null;
        if (cl.checklist_avion) return cl.checklist_avion;
        if (cl.checklist_helicoptero) return cl.checklist_helicoptero;
        return null;
    }, [detalle]);

    const grupos = useMemo(
        () => checklistActual ? clasificarChecklist(checklistActual) : null,
        [checklistActual]
    );

    const marcas = Array.isArray(detalle?.marcas_danio) ? detalle!.marcas_danio : [];

    if (!open || !id) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl bg-white p-6 dark:bg-slate-900">
                <div className="mb-4 border-b pb-3 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">
                                WalkAround #{id}
                            </h2>

                            <p className="text-xs text-gray-500">
                                {detalle?.fecha} · {detalle?.matricula}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="text-lg font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            title="Cerrar"
                        >
                            ✕
                        </button>
                    </div>
                    {/* BANDA DE ESTÁTICAS */}
                    <div
                        className={
                            "mt-4 rounded-lg px-4 py-3 text-center font-semibold tracking-wide " +
                            ((detalle?.numero_estaticas ?? 0) > 0
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300")
                        }
                    >
                        NÚMERO DE ESTÁTICAS:&nbsp;
                        <span className="text-2xl font-bold">
                            {detalle?.numero_estaticas ?? 0}
                        </span>
                    </div>
                </div>

                {loading && <div className="py-10 text-center">Cargando…</div>}

                {!loading && grupos && (
                    <>
                        <div className="mb-4 border-b dark:border-gray-700">
                            <nav className="flex gap-6 text-sm font-semibold">
                                <button
                                    onClick={() => setTab("danio")}
                                    className={tab === "danio"
                                        ? "border-b-2 border-red-600 pb-2 text-red-600"
                                        : "pb-2 text-gray-500"}
                                >
                                    Con daño ({grupos.conDanio.length})
                                </button>
                                <button
                                    onClick={() => setTab("ok")}
                                    className={tab === "ok"
                                        ? "border-b-2 border-emerald-600 pb-2 text-emerald-600"
                                        : "pb-2 text-gray-500"}
                                >
                                    Sin daño ({grupos.ok.length})
                                </button>
                                <button
                                    onClick={() => setTab("pendiente")}
                                    className={tab === "pendiente"
                                        ? "border-b-2 border-gray-600 pb-2 text-gray-600"
                                        : "pb-2 text-gray-500"}
                                >
                                    Pendiente ({grupos.pendiente.length})
                                </button>
                            </nav>
                        </div>

                        <div className="space-y-3">
                            {(tab === "danio" ? grupos.conDanio :
                              tab === "ok" ? grupos.ok :
                              grupos.pendiente
                            ).map(([k, v]) => (
                                <div key={k} className="rounded-lg border p-4 dark:border-gray-700">
                                    <div className="flex justify-between gap-4">
                                        <div className="font-semibold">{k}</div>
                                        <DaniosBadges v={v} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 rounded-lg border p-3 dark:border-gray-700">
                            <MapaDanios3D
                                value={marcas}
                                modelSrc={
                                    detalle?.tipo === "avion"
                                        ? "/models/Avion.obj"
                                        : "/models/18706 Fighter Helicopter_v1.obj"
                                }
                                readOnly
                            />
                        </div>
                    </>
                )}

                <div className="mt-6 flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="rounded-lg border px-4 py-2 text-sm font-semibold"
                    >
                        Cerrar
                    </button>

                    {user?.isAdmin && (
                        <button
                            onClick={handleDelete}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                            Eliminar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
