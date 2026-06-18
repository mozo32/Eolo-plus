import React from "react";
import {
    CheckCircle2,
    CircleDot,
    ClipboardList,
    Clock3,
    Disc,
    Droplet,
    Fuel,
    Gauge,
    Lightbulb,
    Milestone,
    Settings2,
    Truck,
} from "lucide-react";

interface SuministroAgua {
    matricula: string;
    cantidad: string;
}

interface SuministroCombustible {
    hora: string;
    cantidad: string;
}

interface VehiculoData {
    limpieza: string;
    nivel?: string;
    llantas: string;
    frenos?: string;
    obs: string;
    luces?: string;
    estado?: "Operativo" | "Mantenimiento" | "";
    kilometraje?: string;
    suministros?: SuministroAgua[];
    combustibleSuministrado?: "Sí" | "No" | "";
    suministrosCombustible?: SuministroCombustible[];
}

type VehiculoFieldValue = string | SuministroAgua[] | SuministroCombustible[];

interface Props {
    vehiculos: Record<string, VehiculoData>;
    onChange: (
        id: string,
        field: keyof VehiculoData,
        value: VehiculoFieldValue,
    ) => void;
}

const FuelGauge: React.FC<{
    value: string;
    onChange: (value: string) => void;
}> = ({ value, onChange }) => {
    const numericValue = Math.min(Math.max(parseInt(value, 10) || 0, 0), 100);

    const rotation = numericValue * 1.8 - 90;

    return (
        <div className="flex w-full flex-col items-center space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="relative flex h-32 w-64 items-end justify-center overflow-hidden">
                <svg className="absolute bottom-0 h-28 w-56" viewBox="0 0 100 50">
                    <path
                        d="M 10,50 A 40,40 0 0 1 90,50"
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth="8"
                        strokeLinecap="round"
                    />

                    {Array.from({ length: 11 }).map((_, index) => {
                        const angle = index * 18 * (Math.PI / 180);

                        const x1 = 50 - Math.cos(angle) * 35;

                        const y1 = 50 - Math.sin(angle) * 35;

                        const x2 = 50 - Math.cos(angle) * 45;

                        const y2 = 50 - Math.sin(angle) * 45;

                        return (
                            <line
                                key={index}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={index < 3 && numericValue < 20 ? "#ef4444" : "#cbd5e1"}
                                strokeWidth="1"
                            />
                        );
                    })}

                    <path
                        d="M 10,50 A 40,40 0 0 1 90,50"
                        fill="none"
                        stroke={numericValue < 15 ? "#ef4444" : "#3b82f6"}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="125.6"
                        strokeDashoffset={125.6 - numericValue * 1.256}
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>

                <div
                    className="absolute bottom-0 left-1/2 z-10 h-24 w-1 origin-bottom rounded-full bg-red-500 transition-transform duration-1000 ease-out"
                    style={{
                        transform: `translateX(-50%) rotate(${rotation}deg)`,
                    }}
                >
                    <div className="absolute left-0 top-0 h-1/2 w-full rounded-full bg-white/20" />
                </div>

                <div className="absolute bottom-[-12px] left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-slate-800 shadow-lg">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                </div>

                <div className="absolute bottom-2 left-6 text-xs font-black text-slate-400">
                    E
                </div>

                <div className="absolute bottom-2 right-6 text-xs font-black text-slate-400">
                    F
                </div>
            </div>

            <div className="w-full max-w-xs space-y-3 pt-2">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={numericValue}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-100 accent-blue-600"
                />

                <div className="flex justify-center">
                    <div
                        className={`rounded-full border px-4 py-1 text-sm font-black transition-colors ${numericValue < 15
                                ? "animate-pulse border-red-100 bg-red-50 text-red-600"
                                : "border-blue-100 bg-blue-50 text-blue-600"
                            }`}
                    >
                        {numericValue}%
                    </div>
                </div>
            </div>
        </div>
    );
};

const formatearHora24 = (valor: string): string => {
    const numeros = valor.replace(/\D/g, "").slice(0, 4);

    if (numeros.length <= 2) {
        return numeros;
    }

    return `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
};

const esHora24Valida = (hora: string): boolean => {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
};

const VehiculosSection: React.FC<Props> = ({ vehiculos, onChange }) => {
    const optionsBienMal = ["Bien", "Mal"];
    const optionsLimpieza = ["Limpio", "Sucio"];

    return (
        <div className="space-y-8">
            <header className="flex items-center justify-between rounded-t-lg bg-blue-900 p-6 text-white">
                <div>
                    <h1 className="text-2xl font-bold tracking-widest">
                        CONTROL DE FLOTA
                    </h1>

                    <p className="text-sm opacity-80">
                        ESTADO TÉCNICO Y OPERATIVO DE UNIDADES
                    </p>
                </div>

                <Truck size={40} />
            </header>

            <style>
                {`
                    @keyframes spin-slow {
                        from {
                            transform: rotate(0deg);
                        }

                        to {
                            transform: rotate(360deg);
                        }
                    }

                    .animate-spin-slow {
                        animation: spin-slow 3s linear infinite;
                    }

                    input[type='range']::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 18px;
                        height: 18px;
                        background: #2563eb;
                        cursor: pointer;
                        border-radius: 50%;
                        border: 2px solid white;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                    }
                `}
            </style>

            <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
                {Object.entries(vehiculos).map(([id, data]) => {
                    const isMantenimiento = data.estado === "Mantenimiento";

                    const isNissan = id.toLowerCase().includes("nissan");

                    const isTractor = id.toLowerCase().includes("tractor");

                    const listaSuministrosAgua = data.suministros ?? [];

                    const listaSuministrosCombustible = data.suministrosCombustible ?? [];

                    return (
                        <div
                            key={id}
                            className={`group relative overflow-hidden rounded-3xl border-2 transition-all duration-500 ${isMantenimiento
                                    ? "border-red-200 bg-red-50/30"
                                    : "border-gray-100 bg-white shadow-sm hover:border-blue-200"
                                }`}
                        >
                            <div
                                className={`h-1.5 w-full ${isMantenimiento ? "bg-red-500" : "bg-blue-600"}`}
                            />

                            <div className="relative p-4 md:p-6">
                                <div className="relative z-30 mb-6 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <span
                                            className={`rounded-md px-2 py-0.5 text-[9px] font-bold tracking-widest ${isMantenimiento
                                                    ? "bg-red-100 text-red-600"
                                                    : "bg-blue-100 text-blue-600"
                                                }`}
                                        >
                                            Unidad
                                        </span>

                                        <h3
                                            className={`mt-0.5 truncate text-xl font-black md:text-2xl ${isMantenimiento ? "text-gray-400" : "text-gray-800"
                                                }`}
                                        >
                                            {id
                                                .toUpperCase()
                                                .replace(/([A-ZÁÉÍÓÚÑ]+)([0-9]+)/g, "$1 $2")}
                                        </h3>
                                    </div>

                                    <div className="flex shrink-0 rounded-xl border border-gray-200 bg-gray-100 p-1 shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => onChange(id, "estado", "Operativo")}
                                            className={`rounded-lg p-1.5 transition-all md:p-2 ${!isMantenimiento
                                                    ? "bg-white text-green-600 shadow-sm"
                                                    : "text-gray-400 hover:bg-white hover:text-green-600 hover:shadow-sm"
                                                }`}
                                            title="Operativo"
                                        >
                                            <CheckCircle2 size={18} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onChange(id, "estado", "Mantenimiento")}
                                            className={`rounded-lg p-1.5 transition-all md:p-2 ${isMantenimiento
                                                    ? "bg-white text-red-600 shadow-sm"
                                                    : "text-gray-400 hover:bg-white hover:text-red-600 hover:shadow-sm"
                                                }`}
                                            title="Fuera de servicio"
                                        >
                                            <Settings2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div
                                    className={`transition-all duration-300 ${isMantenimiento
                                            ? "pointer-events-none select-none opacity-30 grayscale"
                                            : ""
                                        }`}
                                >
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                        <div className="space-y-1">
                                            <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                <Droplet size={12} />
                                                Limpieza
                                            </label>

                                            <select
                                                value={data.limpieza}
                                                onChange={(event) =>
                                                    onChange(id, "limpieza", event.target.value)
                                                }
                                                className="w-full rounded-xl border-none bg-gray-50 p-2.5 text-sm outline-none"
                                            >
                                                <option value="">--</option>

                                                {optionsLimpieza.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                <Disc size={12} />
                                                Llantas
                                            </label>

                                            <select
                                                value={data.llantas}
                                                onChange={(event) =>
                                                    onChange(id, "llantas", event.target.value)
                                                }
                                                className={`w-full rounded-xl border-none p-2.5 text-sm font-bold outline-none ${data.llantas === "Mal"
                                                        ? "bg-red-50 text-red-600"
                                                        : "bg-gray-50 text-gray-700"
                                                    }`}
                                            >
                                                <option value="">--</option>

                                                {optionsBienMal.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {isNissan && (
                                            <div className="space-y-1">
                                                <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                    <Milestone size={12} />
                                                    Kilometraje
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={data.kilometraje ?? ""}
                                                    onChange={(event) =>
                                                        onChange(id, "kilometraje", event.target.value)
                                                    }
                                                    placeholder="0"
                                                    className="w-full rounded-xl border-none bg-gray-50 p-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        )}

                                        {"frenos" in data && (
                                            <div className="space-y-1">
                                                <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                    <CircleDot size={12} />
                                                    Frenos
                                                </label>

                                                <select
                                                    value={data.frenos ?? ""}
                                                    onChange={(event) =>
                                                        onChange(id, "frenos", event.target.value)
                                                    }
                                                    className={`w-full rounded-xl border-none p-2.5 text-sm font-bold outline-none ${data.frenos === "Mal"
                                                            ? "bg-red-50 text-red-600"
                                                            : "bg-gray-50 text-gray-700"
                                                        }`}
                                                >
                                                    <option value="">--</option>

                                                    {optionsBienMal.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {"luces" in data && (
                                            <div className="space-y-1">
                                                <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                    <Lightbulb size={12} />
                                                    Luces
                                                </label>

                                                <select
                                                    value={data.luces ?? ""}
                                                    onChange={(event) =>
                                                        onChange(id, "luces", event.target.value)
                                                    }
                                                    className={`w-full rounded-xl border-none p-2.5 text-sm font-bold outline-none ${data.luces === "Mal"
                                                            ? "bg-red-50 text-red-600"
                                                            : "bg-gray-50 text-gray-700"
                                                        }`}
                                                >
                                                    <option value="">--</option>

                                                    {optionsBienMal.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {isNissan || isTractor ? (
                                            <div className="col-span-2 space-y-2 pt-2">
                                                <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                    <Gauge size={12} />
                                                    Combustible
                                                </label>

                                                <FuelGauge
                                                    value={data.nivel ?? "0"}
                                                    onChange={(value) => onChange(id, "nivel", value)}
                                                />
                                            </div>
                                        ) : (
                                            "nivel" in data && (
                                                <div className="space-y-1">
                                                    <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                        <Gauge size={12} />
                                                        Nivel de carga
                                                    </label>

                                                    <input
                                                        type="text"
                                                        value={data.nivel ?? ""}
                                                        onChange={(event) =>
                                                            onChange(id, "nivel", event.target.value)
                                                        }
                                                        className="w-full rounded-xl border-none bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Ej. 1/2"
                                                    />
                                                </div>
                                            )
                                        )}

                                        <div className="col-span-2 space-y-1 pt-1">
                                            <label className="ml-1 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                                                <ClipboardList size={12} />
                                                Observaciones
                                            </label>

                                            <textarea
                                                rows={2}
                                                value={data.obs}
                                                placeholder="Detalles adicionales..."
                                                onChange={(event) =>
                                                    onChange(id, "obs", event.target.value)
                                                }
                                                className="w-full resize-none rounded-xl border-none bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                                            />
                                        </div>
                                    </div>

                                    {id === "aguaPotable" && (
                                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                                            <label className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                                                <Droplet size={14} />
                                                Registro de suministro de agua
                                            </label>

                                            <div className="space-y-3">
                                                {listaSuministrosAgua.map((suministro, index) => (
                                                    <div key={index} className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Matrícula"
                                                            value={suministro.matricula}
                                                            onChange={(event) => {
                                                                const nuevosSuministros = [
                                                                    ...listaSuministrosAgua,
                                                                ];

                                                                nuevosSuministros[index] = {
                                                                    ...nuevosSuministros[index],
                                                                    matricula: event.target.value.toUpperCase(),
                                                                };

                                                                onChange(id, "suministros", nuevosSuministros);
                                                            }}
                                                            className="min-w-0 flex-1 rounded-lg border-none bg-white p-2 text-xs font-bold uppercase shadow-sm outline-none focus:ring-2 focus:ring-blue-400"
                                                        />

                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="Cant. (Lts)"
                                                            value={suministro.cantidad}
                                                            onChange={(event) => {
                                                                const nuevosSuministros = [
                                                                    ...listaSuministrosAgua,
                                                                ];

                                                                nuevosSuministros[index] = {
                                                                    ...nuevosSuministros[index],
                                                                    cantidad: event.target.value,
                                                                };

                                                                onChange(id, "suministros", nuevosSuministros);
                                                            }}
                                                            className="w-28 rounded-lg border-none bg-white p-2 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-400"
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const nuevosSuministros =
                                                                    listaSuministrosAgua.filter(
                                                                        (_, suministroIndex) =>
                                                                            suministroIndex !== index,
                                                                    );

                                                                onChange(id, "suministros", nuevosSuministros);
                                                            }}
                                                            className="rounded-lg p-2 text-lg font-bold text-red-500 transition-colors hover:bg-red-100"
                                                            title="Eliminar suministro"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nuevosSuministros = [
                                                            ...listaSuministrosAgua,
                                                            {
                                                                matricula: "",
                                                                cantidad: "",
                                                            },
                                                        ];

                                                        onChange(id, "suministros", nuevosSuministros);
                                                    }}
                                                    className="w-full rounded-xl border-2 border-dashed border-blue-200 py-2 text-xs font-bold uppercase tracking-tight text-blue-500 transition-all hover:bg-blue-100"
                                                >
                                                    + Agregar matrícula
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {isTractor && (
                                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                                    <Fuel size={15} />
                                                    Suministro de combustible al tractor
                                                </label>

                                                <select
                                                    value={data.combustibleSuministrado ?? ""}
                                                    onChange={(event) => {
                                                        const value = event.target.value as
                                                            | "Sí"
                                                            | "No"
                                                            | "";

                                                        onChange(id, "combustibleSuministrado", value);

                                                        if (value === "No") {
                                                            onChange(id, "suministrosCombustible", []);
                                                        }

                                                        if (
                                                            value === "Sí" &&
                                                            listaSuministrosCombustible.length === 0
                                                        ) {
                                                            onChange(id, "suministrosCombustible", [
                                                                {
                                                                    hora: "",
                                                                    cantidad: "",
                                                                },
                                                            ]);
                                                        }
                                                    }}
                                                    className={`h-9 rounded-xl border px-3 text-xs font-black outline-none ${data.combustibleSuministrado === "Sí"
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                            : data.combustibleSuministrado === "No"
                                                                ? "border-red-200 bg-red-50 text-red-600"
                                                                : "border-amber-200 bg-white text-amber-700"
                                                        }`}
                                                >
                                                    <option value="">¿Se suministró?</option>

                                                    <option value="Sí">Sí</option>

                                                    <option value="No">No</option>
                                                </select>
                                            </div>

                                            {data.combustibleSuministrado === "Sí" && (
                                                <div className="space-y-3">
                                                    {listaSuministrosCombustible.map(
                                                        (suministro, index) => {
                                                            const horaValida =
                                                                suministro.hora === "" ||
                                                                esHora24Valida(suministro.hora);

                                                            return (
                                                                <div
                                                                    key={index}
                                                                    className="grid grid-cols-1 gap-3 rounded-xl border border-amber-100 bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
                                                                >
                                                                    <div className="space-y-1">
                                                                        <label className="flex items-center gap-1.5 text-[9px] font-black uppercase text-gray-400">
                                                                            <Clock3 size={12} />
                                                                            Hora
                                                                        </label>

                                                                        <div>
                                                                            <input
                                                                                type="text"
                                                                                inputMode="numeric"
                                                                                maxLength={5}
                                                                                placeholder="HH:MM"
                                                                                value={suministro.hora}
                                                                                onChange={(event) => {
                                                                                    const nuevosSuministros = [
                                                                                        ...listaSuministrosCombustible,
                                                                                    ];

                                                                                    nuevosSuministros[index] = {
                                                                                        ...nuevosSuministros[index],
                                                                                        hora: formatearHora24(
                                                                                            event.target.value,
                                                                                        ),
                                                                                    };

                                                                                    onChange(
                                                                                        id,
                                                                                        "suministrosCombustible",
                                                                                        nuevosSuministros,
                                                                                    );
                                                                                }}
                                                                                className={`h-10 w-full rounded-lg border bg-gray-50 px-3 text-xs font-bold outline-none transition ${horaValida
                                                                                        ? "border-gray-200 text-gray-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                                                                        : "border-red-300 text-red-600 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                                                    }`}
                                                                            />

                                                                            {!horaValida && (
                                                                                <p className="mt-1 text-[9px] font-bold text-red-500">
                                                                                    Escriba una hora válida entre 00:00 y
                                                                                    23:59
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="flex items-center gap-1.5 text-[9px] font-black uppercase text-gray-400">
                                                                            <Fuel size={12} />
                                                                            Cantidad de litros
                                                                        </label>

                                                                        <div className="relative">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                placeholder="0.00"
                                                                                value={suministro.cantidad}
                                                                                onChange={(event) => {
                                                                                    const nuevosSuministros = [
                                                                                        ...listaSuministrosCombustible,
                                                                                    ];

                                                                                    nuevosSuministros[index] = {
                                                                                        ...nuevosSuministros[index],
                                                                                        cantidad: event.target.value,
                                                                                    };

                                                                                    onChange(
                                                                                        id,
                                                                                        "suministrosCombustible",
                                                                                        nuevosSuministros,
                                                                                    );
                                                                                }}
                                                                                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 pr-10 text-xs font-bold text-gray-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                                                            />

                                                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">
                                                                                L
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-end">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const nuevosSuministros =
                                                                                    listaSuministrosCombustible.filter(
                                                                                        (_, suministroIndex) =>
                                                                                            suministroIndex !== index,
                                                                                    );

                                                                                onChange(
                                                                                    id,
                                                                                    "suministrosCombustible",
                                                                                    nuevosSuministros,
                                                                                );
                                                                            }}
                                                                            className="flex h-10 w-full items-center justify-center rounded-lg border border-red-100 bg-red-50 px-3 text-lg font-bold text-red-500 transition hover:bg-red-100 sm:w-10"
                                                                            title="Eliminar suministro"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        },
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const nuevosSuministros = [
                                                                ...listaSuministrosCombustible,
                                                                {
                                                                    hora: "",
                                                                    cantidad: "",
                                                                },
                                                            ];

                                                            onChange(
                                                                id,
                                                                "suministrosCombustible",
                                                                nuevosSuministros,
                                                            );
                                                        }}
                                                        className="w-full rounded-xl border-2 border-dashed border-amber-300 py-2.5 text-xs font-black uppercase tracking-tight text-amber-600 transition hover:bg-amber-100"
                                                    >
                                                        + Agregar suministro de combustible
                                                    </button>
                                                </div>
                                            )}

                                            {data.combustibleSuministrado === "No" && (
                                                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-red-600">
                                                        No se suministró combustible al tractor
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isMantenimiento && (
                                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-red-50/10">
                                        <div className="flex -rotate-3 transform items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-[10px] font-black tracking-widest text-white shadow-lg md:text-xs">
                                            <Settings2 size={14} className="animate-spin-slow" />
                                            FUERA DE SERVICIO
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VehiculosSection;
