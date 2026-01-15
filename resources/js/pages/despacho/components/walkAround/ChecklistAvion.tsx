
import React, { useMemo, useState } from "react";
import {
    ChecklistAvionEstado,
    EstadoPreguntaAvion,
    TipoDanio,
} from "@/types/typesChecklist";
import EvidenciFotografica, {FotoItem} from "./EvidenciFotografica";
/* =====================
   SECCIONES (SE CONSERVAN)
===================== */

const SECCIONES = [
    {
        key: "A",
        label: "A",
        items: [
            "Tren de nariz",
            "Compuertas tren de aterrizaje",
            "Parabrisas / limpiadores",
            "Radomo",
            "Tubo Pitot",
        ],
    },
    {
        key: "B",
        label: "B",
        items: ["Fuselaje", "Antena"],
    },
    {
        key: "C",
        label: "C",
        items: [
            "Aleta",
            "Aleron",
            "Compensador de aleron",
            "Mechas de descarga estatica",
            "Punta de ala",
            "Luces de carreteo / aterrizaje",
            "Luces de navegación, beacon",
            "Borde de ataque",
            "Tren de aterrizaje principal",
            "Válvulas de servicio (combustible, etc...)",
        ],
    },
    {
        key: "D",
        label: "D",
        items: ["Motor"],
    },
    {
        key: "E",
        label: "E",
        items: [
            "Estabilizador vertical",
            "Timón de dirección",
            "Compensador timón de dirección",
            "Estabilizador horizontal",
            "Timón de profundidad",
            "Compensador timón de profundidad",
            "Borde de empenaje",
            "Alas delta",
        ],
    },
] as const;

type SeccionKey = (typeof SECCIONES)[number]["key"];

/* =====================
   DAÑOS
===================== */

const DANIOS: { key: TipoDanio; label: string }[] = [
    { key: "golpe", label: "Golpe" },
    { key: "rayon", label: "Rayón" },
    { key: "fisurado", label: "Fisurado" },
    { key: "quebrado", label: "Quebrado" },
    { key: "pintura_cuarteada", label: "Pint. cuarteada" },
    { key: "otro", label: "Otro" },
];

/* =====================
   HELPERS
===================== */

function getEstado(
    value: ChecklistAvionEstado,
    pregunta: string
): EstadoPreguntaAvion {
    return (
        value[pregunta] ?? {
            izq: false,
            der: false,
            danios: [],
        }
    );
}

/* =====================
   COMPONENTE
===================== */

export default function ChecklistAvion({
    value,
    onChange,
    fotos,
    onChangeFotos,
}: {
    value: ChecklistAvionEstado;
    onChange: (v: ChecklistAvionEstado) => void;
    fotos: FotoItem[];
    onChangeFotos: (fotos: FotoItem[]) => void;
}) {
    const [tab, setTab] = useState<SeccionKey>("A");

    const seccion = useMemo(
        () => SECCIONES.find((s) => s.key === tab)!,
        [tab]
    );

    /* ===== PENDIENTES ===== */
    const pendientes = useMemo(() => {
        return seccion.items.filter((p) => {
            const e = value[p];
            if (!e) return true;
            if (e.danios.length > 0) return false;
            if (e.izq || e.der) return false;
            return true;
        }).length;
    }, [seccion.items, value]);

    /* ===== MARCAR SECCIÓN SIN DAÑO ===== */
    const marcarSeccionSinDanio = () => {
        const next = { ...value };

        seccion.items.forEach((p) => {
            next[p] = {
                izq: false,
                der: false,
                danios: ["sin_danio"],
            };
        });

        onChange(next);
    };

    return (
        <div className="space-y-4">
            {/* ================= HEADER ================= */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">
                        Inspección visual (Avión)
                    </h3>
                    <p className="text-xs text-gray-500">
                        Secciones físicas A–E
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">
                        Pendientes: <b>{pendientes}</b> /{" "}
                        {seccion.items.length}
                    </span>

                    <button
                        type="button"
                        onClick={marcarSeccionSinDanio}
                        className="rounded-md border px-3 py-1 text-xs font-semibold
                                   hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Marcar sección sin daño
                    </button>
                </div>
            </div>
            <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <EvidenciFotografica
                    value={fotos}
                    onChange={onChangeFotos}
                />
            </div>
            {/* ================= TABS ================= */}
            <div className="flex gap-2">
                {SECCIONES.map((s) => (
                    <button
                        key={s.key}
                        type="button"
                        onClick={() => setTab(s.key)}
                        className={`rounded-md border px-3 py-1 text-xs font-semibold
                            ${
                                tab === s.key
                                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                    : "bg-white dark:bg-gray-900"
                            }`}
                    >
                        Sección {s.label}
                    </button>
                ))}
            </div>

            {/* ================= TABLA ================= */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="border px-2 py-1 text-left">
                                Parte del avión
                            </th>
                            <th className="border px-2 py-1">Izq</th>
                            <th className="border px-2 py-1">Der</th>
                            <th className="border px-2 py-1 bg-green-100 dark:bg-green-900/30">
                                Sin daño
                            </th>
                            {DANIOS.map((d) => (
                                <th key={d.key} className="border px-2 py-1">
                                    {d.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {seccion.items.map((pregunta) => {
                            const estado = getEstado(value, pregunta);
                            const sinDanio =
                                estado.danios.includes("sin_danio");

                            return (
                                <tr key={pregunta}>
                                    <td className="border px-2 py-1 font-medium">
                                        {pregunta}
                                    </td>

                                    {/* IZQ */}
                                    <td className="border text-center">
                                        <input
                                            type="checkbox"
                                            checked={estado.izq}
                                            disabled={sinDanio}
                                            onChange={() =>
                                                onChange({
                                                    ...value,
                                                    [pregunta]: {
                                                        ...estado,
                                                        izq: !estado.izq,
                                                        danios:
                                                            estado.danios.filter(
                                                                (d) =>
                                                                    d !==
                                                                    "sin_danio"
                                                            ),
                                                    },
                                                })
                                            }
                                        />
                                    </td>

                                    {/* DER */}
                                    <td className="border text-center">
                                        <input
                                            type="checkbox"
                                            checked={estado.der}
                                            disabled={sinDanio}
                                            onChange={() =>
                                                onChange({
                                                    ...value,
                                                    [pregunta]: {
                                                        ...estado,
                                                        der: !estado.der,
                                                        danios:
                                                            estado.danios.filter(
                                                                (d) =>
                                                                    d !==
                                                                    "sin_danio"
                                                            ),
                                                    },
                                                })
                                            }
                                        />
                                    </td>

                                    {/* SIN DAÑO */}
                                    <td className="border bg-green-50 dark:bg-green-900/20 text-center">
                                        <input
                                            type="checkbox"
                                            checked={sinDanio}
                                            onChange={() =>
                                                onChange({
                                                    ...value,
                                                    [pregunta]: sinDanio
                                                        ? {
                                                              izq: false,
                                                              der: false,
                                                              danios: [],
                                                          }
                                                        : {
                                                              izq: false,
                                                              der: false,
                                                              danios: [
                                                                  "sin_danio",
                                                              ],
                                                          },
                                                })
                                            }
                                        />
                                    </td>

                                    {/* DAÑOS */}
                                    {DANIOS.map((d) => (
                                        <td
                                            key={d.key}
                                            className="border text-center"
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={sinDanio}
                                                checked={estado.danios.includes(
                                                    d.key
                                                )}
                                                onChange={() => {
                                                    const danios =
                                                        estado.danios.includes(
                                                            d.key
                                                        )
                                                            ? estado.danios.filter(
                                                                  (x) =>
                                                                      x !==
                                                                      d.key
                                                              )
                                                            : [
                                                                  ...estado.danios.filter(
                                                                      (x) =>
                                                                          x !==
                                                                          "sin_danio"
                                                                  ),
                                                                  d.key,
                                                              ];

                                                    onChange({
                                                        ...value,
                                                        [pregunta]: {
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
