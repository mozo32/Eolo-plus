import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import ControlMedicamentoPdf from "./ControlMedicamentoPdf";


type Medicamento = {
    inicio: number;
    final: number;
};

type Firma = {
    id: number;
    url: string;
    rol: string;
};

type ControlMedicamento = {
    id: number;
    responsable: string;
    fecha: string;
    dia: string;
    medicamentos: Record<string, Medicamento>;
    firmas: Firma[];
};

const getCurrentWeek = () => {
    const now = new Date();
    const year = now.getFullYear();
    const week = Math.ceil(
        (((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000)
            + new Date(year, 0, 1).getDay() + 1) / 7
    );
    return `${year}-W${String(week).padStart(2, "0")}`;
};

export default function ControlMedicamentoIndex({
    refreshKey,
}: {
    refreshKey: number;
}) {
    const [data, setData] = useState<ControlMedicamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<ControlMedicamento | null>(null);
    const [week, setWeek] = useState(getCurrentWeek());
    const [search, setSearch] = useState("");
    const formatFecha = (fecha: string) => {
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
    };
    function toSameOrigin(url: string) {
        try {
            const u = new URL(url);
            return `${window.location.origin}${u.pathname}`;
        } catch {
            return url;
        }
    }

    async function urlToDataUrl(url: string): Promise<string> {
        const sameOriginUrl = toSameOrigin(url);

        const res = await fetch(sameOriginUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo cargar la firma");

        const blob = await res.blob();

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    const handleExportPdf = async () => {
        // 1. Convertir firmas a base64 (por fecha)
        const firmasBase64PorDia: Record<string, string | null> = {};

        for (const dia of data) {
            const firma = dia.firmas?.find(
                f => f.rol === "firma_responsable"
            );

            firmasBase64PorDia[dia.fecha] = firma?.url
                ? await urlToDataUrl(firma.url)
                : null;
        }

        // 2. Generar PDF
        const blob = await pdf(
            <ControlMedicamentoPdf
                data={data}
                week={week}
                firmasBase64={firmasBase64PorDia}
            />
        ).toBlob();

        // 3. Descargar
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Control_Medicamentos_${week}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
    };
    useEffect(() => {
        setLoading(true);

        const params = new URLSearchParams({
            week,
            search,
        });

        fetch(`/api/ControlMedicamento/index?${params.toString()}`)
            .then((r) => r.json())
            .then((res) => {
                setData(res);
                setLoading(false);
            });
    }, [week, search, refreshKey]);

    if (loading) {
        return (
            <div className="p-10 text-center font-bold">
                Cargando controles...
            </div>
        );
    }
    return (
        <div className="p-6 space-y-6">

            <h1 className="text-2xl font-extrabold text-[#00677F]">
                Control Diario de Medicamentos
            </h1>
            <div className="relative bg-white rounded-2xl shadow-md p-5 overflow-hidden">

                <div className="absolute left-0 top-0 h-full w-2 bg-[#00677F]" />

                <div className="flex flex-col md:flex-row md:items-end gap-4 pl-4">

                    <div className="flex flex-col w-full md:w-64">
                        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                            Semana de control
                        </label>
                        <input
                            type="week"
                            value={week}
                            onChange={(e) => setWeek(e.target.value)}
                            className="border border-slate-300 rounded-xl px-4 py-2.5
                           bg-slate-50 text-slate-800
                           focus:bg-white focus:outline-none
                           focus:ring-2 focus:ring-[#00677F]"
                        />
                    </div>

                    <button
                        onClick={() => setWeek(getCurrentWeek())}
                        className="flex items-center justify-center gap-2
                       bg-[#00677F] text-white font-bold
                       px-6 py-2.5 rounded-xl
                       hover:bg-[#005466] transition
                       w-full md:w-auto"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="25"
                            height="25"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#f4f6f5"
                            stroke-width="1.75"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M15 21h-9a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5" />
                            <path d="M16 3v4" />
                            <path d="M8 3v4" />
                            <path d="M4 11h16" />
                            <path d="M11 15h1" />
                            <path d="M12 15v3" />
                            <path d="M19 16v3" />
                            <path d="M19 22v.01" />
                        </svg>
                        Semana actual
                    </button>
                    <button
                        onClick={handleExportPdf}
                        className="flex items-center justify-center gap-2
                            bg-red-600 text-white font-bold
                            px-6 py-2.5 rounded-xl
                            hover:bg-red-700 transition
                            w-full md:w-auto"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 3v12" />
                            <path d="M8 11l4 4 4-4" />
                            <path d="M5 21h14" />
                        </svg>
                        Exportar PDF
                    </button>
                </div>
            </div>

            {/* LISTADO */}
            {data.length === 0 ? (
                <div className="text-center text-slate-500 font-bold">
                    No hay registros para esta semana
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {data.map((control) => (
                        <div
                            key={control.id}
                            onClick={() => setSelected(control)}
                            className="cursor-pointer rounded-2xl border bg-white p-5 shadow hover:shadow-lg transition"
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="font-extrabold text-slate-700">
                                    {control.responsable}
                                </h2>
                                <span className="text-xs font-bold bg-[#00677F]/10 text-[#00677F] px-2 py-1 rounded-full">
                                    {control.dia}
                                </span>
                            </div>

                            <div className="text-sm text-slate-600">
                                <div><b>Fecha:</b> {formatFecha(control.fecha)}</div>
                                <div>
                                    <b>Medicamentos:</b>{" "}
                                    {Object.keys(control.medicamentos).length}
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-slate-400">
                                    Ver detalle
                                </span>
                                <span className="text-[#00677F] font-bold">
                                    →
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">

                        <div className="flex justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-extrabold text-[#00677F]">
                                    Control Diario
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {selected.responsable} — {selected.fecha}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="text-2xl font-bold text-slate-500 hover:text-red-500"
                            >
                                ×
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(selected.medicamentos).map(
                                ([nombre, val]) => (
                                    <div
                                        key={nombre}
                                        className="rounded-xl border p-4 bg-slate-50"
                                    >
                                        <h3 className="font-bold mb-2">
                                            {nombre}
                                        </h3>
                                        <div className="text-sm">
                                            Inicio: <b>{val.inicio}</b><br />
                                            Final: <b>{val.final}</b><br />
                                            Consumo:{" "}
                                            <b>{val.inicio - val.final}</b>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {selected.firmas?.length > 0 && (
                            <div className="mt-6">
                                <h3 className="font-bold mb-2">
                                    Firma de validación
                                </h3>
                                <img
                                    src={selected.firmas[0].url}
                                    className="h-40 object-contain border rounded"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
