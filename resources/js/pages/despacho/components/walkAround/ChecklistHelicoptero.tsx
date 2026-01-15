import EvidenciFotografica, { FotoItem } from "./EvidenciFotografica";
import React, { useMemo } from "react";
import {
    ChecklistHelicopteroEstado,
    EstadoPreguntaHelicoptero,
    TipoDanio,
} from "@/types/typesChecklist";

interface ChecklistHelicopteroProps {
    value: ChecklistHelicopteroEstado;
    onChange: (v: ChecklistHelicopteroEstado) => void;
    fotos: FotoItem[];
    onChangeFotos: (fotos: FotoItem[]) => void;

}


function getEstado(
    value: ChecklistHelicopteroEstado,
    item: string
): EstadoPreguntaHelicoptero {
    const raw = value[item];

    return {
        izq: raw?.izq ?? false,
        der: raw?.der ?? false,
        danios: Array.isArray(raw?.danios) ? raw.danios : [],
    };
}


const ITEMS = [
    "Fuselaje",
    "Puertas, ventanas, antenas, luces",
    "Esquí / Neumáticos",
    "Palas",
    "Boom",
    "Estabilizadores",
    "Rotor de cola",
    "Parabrisas",
];

const DANIOS: { key: TipoDanio; label: string }[] = [
    { key: "sin_danio", label: "Sin daño" },
    { key: "golpe", label: "Golpe" },
    { key: "rayon", label: "Rayón" },
    { key: "fisurado", label: "Fisurado" },
    { key: "quebrado", label: "Quebrado" },
    { key: "pintura_cuarteada", label: "Pint. cuarteada" },
    { key: "otro", label: "Otro" },
];

function marcarTodoSinDanio(): ChecklistHelicopteroEstado {
    const result: ChecklistHelicopteroEstado = {};

    ITEMS.forEach((item) => {
        result[item] = {
            izq: false,
            der: false,
            danios: ["sin_danio"],
        };
    });

    return result;
}


export default function ChecklistHelicoptero({
    value,
    onChange,
    fotos,
    onChangeFotos,
}: ChecklistHelicopteroProps) {
    const pendientes = useMemo(
        () =>
            ITEMS.filter((i) => {
                const e = value[i];
                if (!e) return true;
                if (e.danios.includes("sin_danio")) return false;
                return e.danios.length === 0;
            }).length,
        [value]
    );
    const fotosActivas = fotos.filter(
        (f) => !(f.kind === "existing" && (f.status ?? "A") === "N")
    ).length;

    const MAX_FOTOS = 4;
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">
                        Inspección visual (Helicóptero)
                    </h3>
                    <p className="text-xs text-gray-500">
                        Tabla única · Formato físico
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">
                        Pendientes: <b>{pendientes}</b> / {ITEMS.length}
                    </span>

                    <button
                        type="button"
                        onClick={() => onChange(marcarTodoSinDanio())}
                        className="rounded-md border px-3 py-1 text-xs font-semibold
                                   hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Marcar todo sin daño
                    </button>
                </div>
            </div>
            <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <EvidenciFotografica
                    value={fotos}
                    onChange={onChangeFotos}
                />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border px-2 py-1 text-left">
                                Parte del helicóptero
                            </th>
                            <th className="border px-2 py-1">Izq</th>
                            <th className="border px-2 py-1">Der</th>
                            {DANIOS.map((d) => (
                                <th key={d.key} className="border px-2 py-1">
                                    {d.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {ITEMS.map((item) => {
                            const estado = getEstado(value, item);
                            const sinDanio = estado.danios.includes("sin_danio");

                            return (
                                <tr key={item}>
                                    <td className="border px-2 py-1 font-medium">
                                        {item}
                                    </td>

                                    <td className="border text-center">
                                        <input
                                            type="checkbox"
                                            checked={estado.izq}
                                            disabled={sinDanio}
                                            onChange={() =>
                                                onChange({
                                                    ...value,
                                                    [item]: {
                                                        ...estado,
                                                        izq: !estado.izq,
                                                        danios: estado.danios.filter(
                                                            (d) => d !== "sin_danio"
                                                        ),
                                                    },
                                                })
                                            }
                                        />
                                    </td>

                                    <td className="border text-center">
                                        <input
                                            type="checkbox"
                                            checked={estado.der}
                                            disabled={sinDanio}
                                            onChange={() =>
                                                onChange({
                                                    ...value,
                                                    [item]: {
                                                        ...estado,
                                                        der: !estado.der,
                                                        danios: estado.danios.filter(
                                                            (d) => d !== "sin_danio"
                                                        ),
                                                    },
                                                })
                                            }
                                        />
                                    </td>

                                    <td className="border text-center bg-green-50">
                                        <input
                                            type="checkbox"
                                            checked={sinDanio}
                                            onChange={() =>
                                                onChange({
                                                    ...value,
                                                    [item]: sinDanio
                                                        ? {
                                                              izq: false,
                                                              der: false,
                                                              danios: [],
                                                          }
                                                        : {
                                                              izq: false,
                                                              der: false,
                                                              danios: ["sin_danio"],
                                                          },
                                                })
                                            }
                                        />
                                    </td>

                                    {/* OTROS DAÑOS */}
                                    {DANIOS.filter(d => d.key !== "sin_danio").map((d) => (
                                        <td key={d.key} className="border text-center">
                                            <input
                                                type="checkbox"
                                                disabled={sinDanio}
                                                checked={estado.danios.includes(d.key)}
                                                onChange={() => {
                                                    const danios = estado.danios.includes(d.key)
                                                        ? estado.danios.filter(
                                                              (x) => x !== d.key
                                                          )
                                                        : [
                                                              ...estado.danios.filter(
                                                                  (x) =>
                                                                      x !== "sin_danio"
                                                              ),
                                                              d.key,
                                                          ];

                                                    onChange({
                                                        ...value,
                                                        [item]: {
                                                            ...estado,
                                                            danios,
                                                        },
                                                    });
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
