export default function Vehiculos({ form, updateField }: any) {
    const unidades = [
        { key: "nissan012", label: "Nissan 012" },
        { key: "nissan015", label: "Nissan 015" },
        { key: "tractor005", label: "Tractor 005" },
        { key: "lektro003", label: "Lektro 003" },
        { key: "lektro007", label: "Lektro 007" },
    ];

    const inputBase = `
        w-full rounded-md border-2 border-slate-400
        bg-slate-100 px-3 py-2 text-sm font-semibold
        shadow-inner
        focus:border-orange-500 focus:bg-white focus:outline-none
    `;

    const selectEstado = (value: string, onChange: any) => (
        <select
            className={inputBase}
            value={value}
            onChange={onChange}
        >
            <option value="">Seleccione</option>
            <option value="Bien">Bien</option>
            <option value="Mal">Mal</option>
        </select>
    );

    return (
        <div className="rounded-xl border border-slate-300 bg-white p-6 shadow">
            <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-orange-600">
                Vehículos / Equipo Terrestre
            </h3>

            <div className="space-y-6">
                {unidades.map((u) => (
                    <div
                        key={u.key}
                        className="rounded-lg border-2 border-slate-300 bg-slate-50 p-5"
                    >
                        {/* HEADER VEHÍCULO */}
                        <div className="mb-4 flex items-center justify-between border-b pb-2">
                            <h4 className="text-sm font-bold uppercase text-slate-700">
                                {u.label}
                            </h4>
                            <span className="text-xs font-semibold text-slate-500">
                                Inspección visual y mecánica
                            </span>
                        </div>

                        {/* CAMPOS */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {/* Limpieza */}
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                                    Limpieza
                                </label>
                                <select
                                    className={inputBase}
                                    value={form.vehiculos[u.key].limpieza}
                                    onChange={(e) =>
                                        updateField(
                                            `vehiculos.${u.key}.limpieza`,
                                            e.target.value
                                        )
                                    }
                                >
                                    <option value="">Seleccione</option>
                                    <option>Limpio</option>
                                    <option>Sucio</option>
                                </select>
                            </div>

                            {/* Nivel */}
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                                    Nivel
                                </label>
                                <input
                                    className={inputBase}
                                    placeholder="Ej. 3/4"
                                    value={form.vehiculos[u.key].nivel}
                                    onChange={(e) =>
                                        updateField(
                                            `vehiculos.${u.key}.nivel`,
                                            e.target.value
                                        )
                                    }
                                />
                            </div>

                            {/* Llantas */}
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                                    Llantas
                                </label>
                                {selectEstado(
                                    form.vehiculos[u.key].llantas,
                                    (e: any) =>
                                        updateField(
                                            `vehiculos.${u.key}.llantas`,
                                            e.target.value
                                        )
                                )}
                            </div>

                            {/* Frenos */}
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                                    Frenos
                                </label>
                                {selectEstado(
                                    form.vehiculos[u.key].frenos,
                                    (e: any) =>
                                        updateField(
                                            `vehiculos.${u.key}.frenos`,
                                            e.target.value
                                        )
                                )}
                            </div>

                            {/* LUCES (NUEVO) */}
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                                    Luces
                                </label>
                                {selectEstado(
                                    form.vehiculos[u.key].luces,
                                    (e: any) =>
                                        updateField(
                                            `vehiculos.${u.key}.luces`,
                                            e.target.value
                                        )
                                )}
                            </div>
                        </div>

                        {/* OBSERVACIONES */}
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                                Observaciones
                            </label>
                            <input
                                className={inputBase}
                                placeholder="Detalle relevante de la unidad"
                                value={form.vehiculos[u.key].obs}
                                onChange={(e) =>
                                    updateField(
                                        `vehiculos.${u.key}.obs`,
                                        e.target.value
                                    )
                                }
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* AGUAS NEGRAS */}
            <div className="mt-8 rounded-lg border-2 border-orange-400 bg-orange-50 p-5">
                <h4 className="mb-4 text-sm font-bold uppercase text-orange-700">
                    Carro de Aguas Negras – Unidad 008
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <select
                        className={inputBase}
                        value={form.vehiculos.aguasNegras008.limpieza}
                        onChange={(e) =>
                            updateField(
                                "vehiculos.aguasNegras008.limpieza",
                                e.target.value
                            )
                        }
                    >
                        <option value="">Limpieza</option>
                        <option>Limpio</option>
                        <option>Sucio</option>
                    </select>

                    <select
                        className={inputBase}
                        value={form.vehiculos.aguasNegras008.llantas}
                        onChange={(e) =>
                            updateField(
                                "vehiculos.aguasNegras008.llantas",
                                e.target.value
                            )
                        }
                    >
                        <option value="">Llantas</option>
                        <option>Bien</option>
                        <option>Mal</option>
                    </select>

                    <input
                        className={inputBase}
                        placeholder="Observaciones"
                        value={form.vehiculos.aguasNegras008.obs}
                        onChange={(e) =>
                            updateField(
                                "vehiculos.aguasNegras008.obs",
                                e.target.value
                            )
                        }
                    />
                </div>
            </div>
        </div>
    );
}
