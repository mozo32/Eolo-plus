import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import WalkAroundForm from "../WalkAroundForm";
import { WalkAroundDetalle, fetchWalkaroundDetalle } from "@/stores/apiWalkaround";
import type { FotoItem } from "../EvidenciFotografica";
import {
  TipoDanio,
  ChecklistAvionEstado,
  ChecklistHelicopteroEstado,
} from "@/types/typesChecklist";

type Props = {
    id: number | null;
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
};

const DANIOS_VALIDOS = [
    "sin_danio",
    "golpe",
    "rayon",
    "fisurado",
    "quebrado",
    "pintura_cuarteada",
    "otro",
] as const;

function toChecklistHelicopteroEstado(input: unknown): ChecklistHelicopteroEstado {
    const out: ChecklistHelicopteroEstado = {};
    if (!input || typeof input !== "object") return out;

    for (const [k, v] of Object.entries(input as Record<string, any>)) {
        const rawDanios = Array.isArray(v?.danios)
            ? v.danios.filter(isTipoDanio)
            : normalizeToArray(v);

        out[k] = {
            izq: Boolean(v?.izq),
            der: Boolean(v?.der),
            danios: rawDanios,
        };
    }

    return out;
}
function toChecklistAvionEstado(input: unknown): ChecklistAvionEstado {
    const out: ChecklistAvionEstado = {};
    if (!input || typeof input !== "object") return out;

    for (const [k, v] of Object.entries(input as Record<string, any>)) {
        const rawDanios = Array.isArray(v?.danios)
            ? v.danios.filter(isTipoDanio)
            : normalizeToArray(v);

        out[k] = {
            izq: Boolean(v?.izq),
            der: Boolean(v?.der),
            danios: rawDanios,
        };
    }

    return out;
}
function isTipoDanio(x: unknown): x is TipoDanio {
    return typeof x === "string" && (DANIOS_VALIDOS as readonly string[]).includes(x);
}

function normalizeToArray(v: unknown): TipoDanio[] {
    if (Array.isArray(v)) return v.filter(isTipoDanio);
    if (v === "sin_danio") return ["sin_danio"];
    if (v === "con_danio") return ["otro"];
    return [];
}

function toSameOrigin(url: string) {
    try {
        const u = new URL(url, window.location.origin);
        return `${window.location.origin}${u.pathname}${u.search}`;
    } catch {
        return url;
    }
}

async function urlToBase64(url: string): Promise<string> {
    const fixed = toSameOrigin(url);
    const res = await fetch(fixed);
    if (!res.ok) throw new Error(`No se pudo cargar firma: ${res.status}`);

    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export default function WalkAroundEditarModal({ id, open, onClose, onSaved }: Props) {
    const [detalle, setDetalle] = useState<WalkAroundDetalle | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || id == null) return;

        const load = async () => {
            setLoading(true);
            setDetalle(null);

            try {
                const data = await fetchWalkaroundDetalle(id);
                if (Array.isArray((data as any).firmas) && (data as any).firmas.length) {
                    const firmasActivas = (data as any).firmas.filter((f: any) => (f.status ?? "A") === "A");

                    const jefe = firmasActivas.find((f: any) => f.rol === "jefe_area");
                    const fbo = firmasActivas.find((f: any) => f.rol === "fbo");
                    const resp = firmasActivas.find((f: any) => f.rol === "responsable");

                    const [jefeB64, fboB64, respB64] = await Promise.all([
                        jefe?.url ? urlToBase64(jefe.url) : Promise.resolve(""),
                        fbo?.url ? urlToBase64(fbo.url) : Promise.resolve(""),
                        resp?.url ? urlToBase64(resp.url) : Promise.resolve(""),
                    ]);

                    (data as any).__firmasBase64 = {
                        firmaJefeAreaBase64: jefeB64,
                        firmaFboBase64: fboB64,
                        firmaResponsableBase64: respB64,
                    };
                }

                setDetalle(data);
            } catch (e: any) {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: e?.message || "No se pudo cargar el registro para editar",
                });
                onClose();
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [open, id]);

    const initialData = useMemo(() => {
        if (!detalle) return undefined;

        const checklistAvion = toChecklistAvionEstado(
            detalle.checklists?.checklist_avion
        );

        const checklistHelicoptero = toChecklistHelicopteroEstado(
            detalle.checklists?.checklist_helicoptero
        );

        const fotosExistentes: FotoItem[] = (detalle.imagenes ?? [])
            .filter((i: any) => (i.status ?? "A") === "A")
            .map((i: any) => ({
                kind: "existing",
                id: i.id,
                url: i.url,
                status: (i.status ?? "A") as "A" | "N",
            }));
        const firmasB64 = (detalle as any).__firmasBase64 ?? {};

        return {
            fecha: detalle.fecha,
            movimiento: detalle.movimiento,
            matricula: detalle.matricula,
            tipo: detalle.tipo,
            tipoAeronave: detalle.tipoAeronave ?? "",
            AeronaveId: (detalle as any).tipo_aeronave_id ?? (detalle.tipo === "avion" ? 1 : 2),

            hora: detalle.hora ?? "",
            destino: detalle.destino ?? "",
            procedensia: detalle.procedensia ?? "",

            observaciones: detalle.observaciones ?? "",
            elabora_departamento_id: (detalle.elabora_departamento_id ?? "") as number | "",
            elabora_personal_id:(detalle.elabora_personal_id ?? "") as number | "",
            elabora: detalle.elabora ?? "",
            responsable: detalle.responsable ?? "",
            jefeArea: detalle.jefe_area ?? "",
            fbo: detalle.fbo ?? "",

            checklistAvion,
            checklistHelicoptero,
            marcaDanos: Array.isArray(detalle.marcas_danio)
                ? detalle.marcas_danio.map((p: any) => ({
                    x: Number(p.x),
                    y: Number(p.y),
                    z: Number(p.z ?? 0),
                    descripcion: p.descripcion ?? null,
                    severidad: p.severidad ?? null,
                }))
            : [],
            numeroEstatica: detalle.numero_estaticas ?? 0,
            fotos: fotosExistentes,
            firmaJefeAreaBase64: firmasB64.firmaJefeAreaBase64 ?? "",
            firmaFboBase64: firmasB64.firmaFboBase64 ?? "",
            firmaResponsableBase64: firmasB64.firmaResponsableBase64 ?? "",
        };
    }, [detalle]);

    if (!open || id == null) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="relative w-full max-w-7xl max-h-[95vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-200 pb-2 dark:border-gray-700">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            Editar WalkAround #{id}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {detalle?.fecha ?? ""} · {detalle?.matricula ?? ""}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                        hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    >
                        ✕
                    </button>
                </div>

                {loading && <div className="py-10 text-center text-sm text-gray-500">Cargando...</div>}

                {!loading && detalle && initialData && (
                    <WalkAroundForm
                        open={open}
                        mode="edit"
                        walkaroundId={id}
                        initialData={initialData}
                        onClose={onClose}
                        onSaved={() => onSaved?.()}
                    />
                )}
            </div>
        </div>
    );
}
