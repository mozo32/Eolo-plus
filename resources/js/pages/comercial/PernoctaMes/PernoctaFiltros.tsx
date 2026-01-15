import React from "react";

const MESES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

interface Props {
    modo: "anio" | "mes" | "rango";
    setModo: (v: "anio" | "mes" | "rango") => void;
    anio: string;
    setAnio: (v: string) => void;
    mes: string;
    setMes: (v: string) => void;
    mesDesde: string;
    setMesDesde: (v: string) => void;
    mesHasta: string;
    setMesHasta: (v: string) => void;
    ubicacion: string;
    setUbicacion: (v: string) => void;
    matricula: string;
    setMatricula: (v: string) => void;
    anios: string[];
}

const inputBase =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition " +
    "focus:border-primary focus:ring-2 focus:ring-primary/30 " +
    "dark:border-gray-700 dark:bg-gray-900";

export default function PernoctaFiltros({
    modo, setModo,
    anio, setAnio,
    mes, setMes,
    mesDesde, setMesDesde,
    mesHasta, setMesHasta,
    ubicacion, setUbicacion,
    matricula, setMatricula,
    anios, // ✅ AQUI ESTABA EL PROBLEMA
}: Props) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div>
                    <label className="mb-1 block text-xs font-medium">Tipo</label>
                    <select
                        value={modo}
                        onChange={(e) => setModo(e.target.value as any)}
                        className={inputBase}
                    >
                        <option value="anio">Por año</option>
                        <option value="mes">Por mes</option>
                        <option value="rango">Rango de meses</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium">Año</label>
                    <select
                        value={anio}
                        onChange={(e) => setAnio(e.target.value)}
                        className={inputBase}
                    >
                        {anios.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                </div>

                {modo === "mes" && (
                    <div>
                        <label className="mb-1 block text-xs font-medium">Mes</label>
                        <select value={mes} onChange={(e) => setMes(e.target.value)} className={inputBase}>
                            {MESES.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                )}

                {modo === "rango" && (
                    <>
                        <div>
                            <label className="mb-1 block text-xs font-medium">Mes desde</label>
                            <select value={mesDesde} onChange={(e) => setMesDesde(e.target.value)} className={inputBase}>
                                {MESES.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium">Mes hasta</label>
                            <select value={mesHasta} onChange={(e) => setMesHasta(e.target.value)} className={inputBase}>
                                {MESES.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                <div>
                    <label className="mb-1 block text-xs font-medium">Ubicación</label>
                    <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={inputBase}>
                        <option value="">Todas</option>
                        <option value="H1">Hangar 1</option>
                        <option value="H2">Hangar 2</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium">Matrícula</label>
                    <input
                        value={matricula}
                        onChange={(e) => setMatricula(e.target.value)}
                        className={inputBase}
                    />
                </div>
            </div>
        </div>
    );
}
