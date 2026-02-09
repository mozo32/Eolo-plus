const Section = ({ title, children }: any) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h3 className="mb-6 text-left text-xs font-bold uppercase tracking-[0.15em] text-blue-600/80">
            {title}
        </h3>
        {children}
    </div>
);

export default function EquipoComunicaciones({ form, updateField }: any) {
    const inputStyle = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50 placeholder:text-slate-400";
    const labelStyle = "mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500";

    return (
        <Section title="Equipo de Comunicaciones">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="flex flex-col">
                    <label className={labelStyle}>No. de Radios</label>
                    <input
                        type="number"
                        className={inputStyle}
                        placeholder="0"
                        value={form.comunicaciones.radios}
                        onChange={(e) =>
                            updateField("comunicaciones.radios", e.target.value)
                        }
                    />
                </div>

                {/* RADIOFRECUENCIA */}
                <div className="flex flex-col">
                    <label className={labelStyle}>Radiofrecuencia</label>
                    <input
                        type="number"
                        className={inputStyle}
                        placeholder="Canal"
                        value={form.comunicaciones.radioFrecuencia}
                        onChange={(e) =>
                            updateField(
                                "comunicaciones.radioFrecuencia",
                                e.target.value
                            )
                        }
                    />
                </div>

                {/* ESTADO */}
                <div className="flex flex-col justify-end">
                    <span className={labelStyle}>Estado General</span>

                    <div className="flex h-[42px] items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4">
                        <span
                            className={`text-xs font-bold uppercase tracking-tight ${form.comunicaciones.radiosFuncionando
                                    ? "text-blue-600"
                                    : "text-slate-400"
                                }`}
                        >
                            {form.comunicaciones.radiosFuncionando
                                ? "Operativo"
                                : "Fuera de servicio"}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                updateField(
                                    "comunicaciones.radiosFuncionando",
                                    !form.comunicaciones.radiosFuncionando
                                )
                            }
                            className={`relative h-6 w-11 rounded-full transition-colors duration-200 ease-in-out ${form.comunicaciones.radiosFuncionando
                                    ? "bg-blue-500"
                                    : "bg-slate-300"
                                }`}
                        >
                            <span
                                className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.comunicaciones.radiosFuncionando
                                        ? "translate-x-5"
                                        : ""
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* MENSAJE CONTEXTUAL */}
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-blue-50 bg-blue-50/30 p-4">
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                <p className="text-[11px] font-medium leading-relaxed text-blue-700/70">
                    Asegúrese de reportar cualquier anomalía técnica en la frecuencia antes de finalizar la entrega.
                </p>
            </div>
        </Section>
    );
}
