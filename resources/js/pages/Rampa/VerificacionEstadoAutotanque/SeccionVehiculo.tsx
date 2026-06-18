import React from "react";
import {
    AlertTriangle,
    Clock3,
    Fuel,
    Milestone,
} from "lucide-react";

export interface SuministroCombustible {
    suministrado: "Sí" | "No" | "";
    hora: string;
    litros: string;
}

export interface DatosVehiculo {
    km: string;
    combustible: string;
    suministroCombustible: SuministroCombustible;
}

interface Props {
    datos: DatosVehiculo;
    onChange: React.Dispatch<
        React.SetStateAction<DatosVehiculo>
    >;
}

export const SeccionVehiculo = ({
    datos,
    onChange,
}: Props) => {
    const nivel = Math.min(
        Math.max(Number(datos.combustible) || 0, 0),
        100,
    );

    const rotation = nivel * 1.8 - 90;

    const suministro = datos.suministroCombustible;
    const formatearHora24 = (valor: string) => {
        const numeros = valor
            .replace(/\D/g, "")
            .slice(0, 4);

        if (numeros.length <= 2) {
            return numeros;
        }

        return `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
    };
    const horaValida =
        suministro.hora === "" ||
        /^([01]\d|2[0-3]):[0-5]\d$/.test(
            suministro.hora,
        );
    const getStatusColor = () => {
        if (nivel <= 15) {
            return "text-red-500";
        }

        if (nivel <= 40) {
            return "text-amber-500";
        }

        return "text-green-500";
    };

    const actualizarSuministro = (
        cambios: Partial<SuministroCombustible>,
    ) => {
        onChange({
            ...datos,
            suministroCombustible: {
                ...suministro,
                ...cambios,
            },
        });
    };

    return (
        <div className="animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                        <Milestone size={20} />
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-800">
                            Lectura de Odómetro
                        </h3>

                        <p className="text-[10px] font-medium uppercase text-gray-400">
                            Ingrese el kilometraje actual
                        </p>
                    </div>
                </div>

                <div className="group relative">
                    <input
                        type="number"
                        min="0"
                        placeholder="000000"
                        className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-6 py-5 font-mono text-4xl text-gray-800 outline-none transition-all focus:border-blue-500 focus:bg-white"
                        value={datos.km}
                        onChange={(event) =>
                            onChange({
                                ...datos,
                                km: event.target.value,
                            })
                        }
                    />

                    <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 select-none text-xl font-black italic text-gray-300">
                        KM
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center rounded-[40px] border border-white bg-[#f8fafc] p-8 shadow-inner">
                <h3 className="mb-10 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                    <Fuel size={14} />
                    Fuel Gauge System
                </h3>

                <div className="relative h-40 w-72">
                    <svg
                        viewBox="0 0 200 110"
                        className="w-full"
                    >
                        <path
                            d="M 20 100 A 80 80 0 0 1 180 100"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />

                        <path
                            d="M 20 100 A 80 80 0 0 1 41 47"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="11"
                            strokeDasharray="2, 4"
                        />

                        {[0, 25, 50, 75, 100].map(
                            (porcentaje) => {
                                const angle =
                                    porcentaje * 1.8 -
                                    180;

                                const x1 =
                                    100 +
                                    75 *
                                    Math.cos(
                                        (angle *
                                            Math.PI) /
                                        180,
                                    );

                                const y1 =
                                    100 +
                                    75 *
                                    Math.sin(
                                        (angle *
                                            Math.PI) /
                                        180,
                                    );

                                const x2 =
                                    100 +
                                    87 *
                                    Math.cos(
                                        (angle *
                                            Math.PI) /
                                        180,
                                    );

                                const y2 =
                                    100 +
                                    87 *
                                    Math.sin(
                                        (angle *
                                            Math.PI) /
                                        180,
                                    );

                                return (
                                    <line key={porcentaje} x1={x1} y1={y1} x2={x2} y2={y2}
                                        stroke="#94a3b8"
                                        strokeWidth="2"
                                    />
                                );
                            },
                        )}

                        <text
                            x="15"
                            y="110"
                            fontSize="8"
                            fontWeight="bold"
                            fill="#ef4444"
                        >
                            E
                        </text>

                        <text
                            x="175"
                            y="110"
                            fontSize="8"
                            fontWeight="bold"
                            fill="#64748b"
                        >
                            F
                        </text>
                    </svg>

                    <div
                        className="absolute bottom-0 left-1/2 h-32 w-1 origin-bottom rounded-full bg-red-600 shadow-lg transition-transform duration-1000 ease-out"
                        style={{
                            transform: `translateX(-50%) rotate(${rotation}deg)`,
                        }}
                    >
                        <div className="absolute bottom-0 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border-4 border-slate-700 bg-slate-800 shadow-md" />
                    </div>
                </div>

                <div className="mt-4 flex flex-col items-center text-center">
                    <div
                        className={`text-4xl font-black italic tracking-tighter ${getStatusColor()}`}
                    >
                        {nivel}%
                    </div>

                    {nivel <= 15 && (
                        <div className="mt-1 flex animate-bounce items-center gap-1 text-red-500">
                            <AlertTriangle size={12} />

                            <span className="text-[10px] font-bold uppercase">
                                Advertencia de
                                combustible bajo
                            </span>
                        </div>
                    )}
                </div>

                <input
                    type="range"
                    min="0"
                    max="100"
                    className="mt-10 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-800"
                    value={nivel}
                    onChange={(event) =>
                        onChange({
                            ...datos,
                            combustible:
                                event.target.value,
                        })
                    }
                />
            </div>

            <div className="flex gap-2">
                {[0, 50, 100].map((valor) => (
                    <button
                        key={valor}
                        type="button"
                        onClick={() =>
                            onChange({
                                ...datos,
                                combustible:
                                    valor.toString(),
                            })
                        }
                        className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-[10px] font-bold text-slate-400 transition-all hover:bg-slate-50 active:scale-95"
                    >
                        SET {valor}%
                    </button>
                ))}
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600">
                            <Fuel size={20} />
                        </div>

                        <div>
                            <h3 className="text-sm font-black text-gray-800">
                                Suministro de combustible
                            </h3>

                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Registro de cargas
                            </p>
                        </div>
                    </div>

                    <select
                        value={
                            suministro.suministrado
                        }
                        onChange={(event) => {
                            const valor =
                                event.target
                                    .value as SuministroCombustible["suministrado"];

                            if (valor === "No") {
                                actualizarSuministro({
                                    suministrado:
                                        "No",
                                    hora: "",
                                    litros: "",
                                });

                                return;
                            }

                            actualizarSuministro({
                                suministrado:
                                    valor,
                            });
                        }}
                        className={`h-10 rounded-xl border px-4 text-xs font-black outline-none ${suministro.suministrado ===
                                "Sí"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : suministro.suministrado ===
                                    "No"
                                    ? "border-red-200 bg-red-50 text-red-600"
                                    : "border-amber-200 bg-white text-amber-700"
                            }`}
                    >
                        <option value="">
                            ¿Se suministró?
                        </option>

                        <option value="Sí">
                            Sí
                        </option>

                        <option value="No">
                            No
                        </option>
                    </select>
                </div>

                {suministro.suministrado ===
                    "Sí" && (
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                    <Clock3 size={14} />
                                    Hora del suministro
                                </label>

                                <div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={5}
                                        placeholder="HH:MM"
                                        value={suministro.hora}
                                        onChange={(event) =>
                                            actualizarSuministro({
                                                hora: formatearHora24(
                                                    event.target.value,
                                                ),
                                            })
                                        }
                                        className={`h-12 w-full rounded-xl border bg-white px-4 text-sm font-bold outline-none transition ${horaValida
                                                ? "border-gray-200 text-gray-700 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                                : "border-red-300 text-red-600 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                            }`}
                                    />

                                    {!horaValida && (
                                        <p className="mt-1 text-[10px] font-bold text-red-500">
                                            Escriba una hora válida entre 00:00 y
                                            23:59
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                    <Fuel size={14} />
                                    Cantidad de litros
                                </label>

                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={
                                            suministro.litros
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            actualizarSuministro(
                                                {
                                                    litros: event
                                                        .target
                                                        .value,
                                                },
                                            )
                                        }
                                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-14 text-sm font-bold text-gray-700 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                    />

                                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                                        LTS
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                {suministro.suministrado ===
                    "No" && (
                        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-600">
                                No se suministró
                                combustible al vehículo
                            </p>
                        </div>
                    )}
            </div>
        </div>
    );
};
