import { useState } from "react";


const MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
];

const EQUIPOS = [
    "Lentes",
    "Guantes",
    "Cascos",
    "Chaleco",
    "Botas",
    "Gorras",
    "Rodilleras",
    "Fajas",
    "Guantes PVC",
    "Bandas de luces",
    "Impermeable",
    "Tenis",
    "Botas de hule",
];

export default function CheckListEquipoForm() {
    const [mesActivo, setMesActivo] = useState<string>("Enero");

    const [form, setForm] = useState<any>({
        nombre: "",
        checklist: {},
        observaciones: "",
    });

    const toggleEquipo = (equipo: string) => {
        setForm((prev: any) => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                [mesActivo]: {
                    ...(prev.checklist[mesActivo] || {}),
                    [equipo]: !prev.checklist?.[mesActivo]?.[equipo],
                },
            },
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("CHECKLIST EQUIPO DE SEGURIDAD:", form);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-6xl space-y-8 rounded-xl border border-slate-300 bg-white p-8 shadow-md"
        >
            {/* ===== ENCABEZADO ===== */}
            <div className="border-b pb-4">
                <h2 className="text-center text-2xl font-extrabold uppercase tracking-wider text-[#00677F]">
                    Checklist de Equipo de Seguridad
                </h2>
            </div>

            {/* ===== DATOS DEL EMPLEADO ===== */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                        Nombre del empleado
                    </label>
                    <input
                        className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                        placeholder="Nombre completo"
                        value={form.nombre}
                        onChange={(e) =>
                            setForm({ ...form, nombre: e.target.value })
                        }
                    />
                </div>

                <div className="flex items-center justify-center rounded-md border border-[#00677F] bg-[#E6F2F6]">
                    <span className="text-sm font-extrabold uppercase tracking-wide text-[#00677F]">
                        Registro mensual
                    </span>
                </div>
            </div>

            {/* ===== SELECTOR DE MES ===== */}
            <div className="rounded-md border border-slate-300 bg-slate-100 p-3">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {MESES.map((mes) => (
                        <button
                            key={mes}
                            type="button"
                            onClick={() => setMesActivo(mes)}
                            className={`rounded-md px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition
                            ${mesActivo === mes
                                    ? "bg-[#00677F] text-white shadow"
                                    : "bg-white text-slate-700 hover:bg-slate-200"
                                }`}
                        >
                            {mes}
                        </button>
                    ))}
                </div>
            </div>

            {/* ===== CHECKLIST ===== */}
            <div className="rounded-xl border-2 border-[#00677F] bg-[#E6F2F6] p-6">
                <h3 className="mb-5 text-sm font-extrabold uppercase tracking-widest text-[#00677F]">
                    {mesActivo}
                </h3>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {EQUIPOS.map((equipo) => (
                        <label
                            key={equipo}
                            className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
                        >
                            <input
                                type="checkbox"
                                checked={
                                    !!form.checklist?.[mesActivo]?.[equipo]
                                }
                                onChange={() => toggleEquipo(equipo)}
                                className="h-5 w-5 accent-[#00677F]"
                            />
                            {equipo}
                        </label>
                    ))}
                </div>
            </div>

            {/* ===== OBSERVACIONES ===== */}
            <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Observaciones generales
                </label>
                <textarea
                    className="w-full min-h-[140px] rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-medium focus:border-[#00677F] focus:outline-none"
                    placeholder="Anotar cualquier observación relevante del equipo de seguridad"
                    value={form.observaciones}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            observaciones: e.target.value,
                        })
                    }
                />
            </div>

            {/* ===== ACCIÓN ===== */}
            <div className="flex justify-end">
                <button
                    type="submit"
                    className="rounded-md bg-[#00677F] px-10 py-3 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-[#00586D]"
                >
                    Guardar Checklist
                </button>
            </div>
        </form>
    );


}
