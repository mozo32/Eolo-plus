const Section = ({ title, children }: any) => (
    <div className="rounded-xl border border-slate-300 bg-white p-6 shadow">
        <h3 className="mb-6 text-left text-sm font-bold uppercase tracking-widest text-orange-600">
            {title}
        </h3>
        {children}
    </div>
);

export default function EquipoComunicaciones({ form, updateField }: any) {
    return (
        <Section title="Equipo de Comunicaciones">

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

                {/* NÚMERO DE RADIOS */}
                <div className="flex flex-col">
                    <label className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        No. de Radios
                    </label>
                    <input
                        type="number"
                        className="
                            w-full rounded-md border-2 border-slate-400
                            bg-slate-100 px-3 py-2 text-sm font-semibold
                            shadow-inner
                            placeholder:text-slate-400
                            focus:border-orange-500 focus:bg-white focus:outline-none
                        "
                        placeholder="Ej. 5"
                        value={form.comunicaciones.radios}
                        onChange={(e) =>
                            updateField("comunicaciones.radios", e.target.value)
                        }
                    />
                </div>

                {/* RADIOFRECUENCIA */}
                <div className="flex flex-col">
                    <label className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Radiofrecuencia
                    </label>
                    <input
                        type="number"
                        className="
                            w-full rounded-md border-2 border-slate-400
                            bg-slate-100 px-3 py-2 text-sm font-semibold
                            shadow-inner
                            placeholder:text-slate-400
                            focus:border-orange-500 focus:bg-white focus:outline-none
                        "
                        placeholder="Ej. 28"
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
                <div className="flex flex-col">
                    <span className="mb-2 text-xs font-bold uppercase text-gray-700">
                        Estado General
                    </span>

                    <label className="flex items-center justify-between">
                        <span
                            className={`text-sm font-bold ${
                                form.comunicaciones.radiosFuncionando
                                    ? "text-green-600"
                                    : "text-red-600"
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
                            className={`relative h-7 w-14 rounded-full transition ${
                                form.comunicaciones.radiosFuncionando
                                    ? "bg-green-500"
                                    : "bg-red-500"
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                    form.comunicaciones.radiosFuncionando
                                        ? "translate-x-7"
                                        : ""
                                }`}
                            />
                        </button>
                    </label>
                </div>
            </div>

            {/* MENSAJE CONTEXTUAL */}
            <div className="mt-5 rounded-md border border-slate-300 bg-slate-50 p-3 text-xs font-medium text-slate-600">
                Registrar el estado general de los radios asignados al turno.
            </div>

        </Section>
    );
}
