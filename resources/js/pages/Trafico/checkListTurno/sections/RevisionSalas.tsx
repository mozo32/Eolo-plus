import { useState, useEffect } from "react";

const SALAS = [
    { id: "aula_1", label: "Aula 1" },
    { id: "aula_2", label: "Aula 2" },
    { id: "sala_pilotos", label: "Sala de Pilotos" },
    { id: "sala_gimnasio", label: "Sala Gimnasio" },
    { id: "oficina_direccion", label: "Oficina Dirección" },
    { id: "salas_juntas_2do_piso", label: "Salas de Juntas 2do Piso" },
    { id: "sala_frente_trafico", label: "Sala Frente a Tráfico" },
    { id: "salas_vip_pax", label: "Salas VIP Pax" },
];

const HORAS = ["07:00", "10:00", "13:00", "16:00", "19:00"];

type Props = {
    form: any;
    updateField: (path: string, value: any) => void;
};

export default function RevisionSalas({ form, updateField }: Props) {

    const toggleCheck = (salaId: string, hora: string) => {
        const actual = form.revisionSalas?.[salaId]?.[hora] ?? false;
        updateField(`revisionSalas.${salaId}.${hora}`, !actual);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">
                        Inspección de Salas
                    </h3>
                    <p className="text-xs font-medium text-slate-500">
                        Verificación de orden, limpieza y suministros de cafetería.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 border border-amber-100">
                    <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-[10px] font-bold uppercase text-amber-700">Revisión cada 3 horas</span>
                </div>
            </div>

            {/* Contenedor de la Matriz */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80">
                                <th className="sticky left-0 z-10 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Ubicación / Área
                                </th>
                                {HORAS.map((hora) => (
                                    <th key={hora} className="border-b border-slate-200 px-4 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-black text-slate-700">{hora}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">hrs</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {SALAS.map(({ id, label }) => (
                                <tr key={id} className="group transition-colors hover:bg-slate-50/50">
                                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 px-6 py-4 transition-colors">
                                        <span className="text-sm font-bold text-slate-700">{label}</span>
                                    </td>

                                    {HORAS.map((hora) => {
                                        const isChecked = !!form.revisionSalas?.[id]?.[hora];
                                        return (
                                            <td key={hora} className="p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCheck(id, hora)}
                                                    className={`flex h-12 w-full items-center justify-center rounded-xl border-2 transition-all duration-200 ${
                                                        isChecked
                                                            ? "border-sky-500 bg-sky-50 shadow-sm shadow-sky-100"
                                                            : "border-transparent bg-slate-50/30 hover:border-slate-200 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                                                        isChecked ? "bg-sky-600 scale-110 shadow-md" : "bg-slate-200 scale-100"
                                                    }`}>
                                                        {isChecked ? (
                                                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        ) : (
                                                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                                        )}
                                                    </div>
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECCIÓN NUEVA: Observaciones específicas de Inspección de Salas */}
            <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Observaciones / Novedades en Salas
                </label>
                <textarea
                    rows={3}
                    className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-[#00677F] transition-all placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="Escribe aquí si encontraste alguna anomalía, objetos olvidados o falta de insumos de cafetería en las salas..."
                    value={form.observaciones_salas ?? ""}
                    onChange={(e) => updateField("observaciones_salas", e.target.value)}
                />
            </div>

            {/* Pie de sección informativo */}
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200 p-4">
                <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                    Se revisa que no haya objetos olvidados, se mantenga el orden y el servicio de aguas y cafetería esté completo.
                </p>
            </div>
        </div>
    );
}
