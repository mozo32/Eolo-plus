type Props = {
    form: any;
    updateField: (path: string, value: any) => void;
};

export default function BarrasRemolque({ form, updateField }: Props) {
    if (!form?.barrasRemolque) return null;

    const label =
        "mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-700";

    const input =
        "w-full rounded-lg border-2 border-slate-400 bg-slate-100 px-4 py-2 text-sm font-bold focus:border-slate-600 focus:outline-none";

    const select =
        "w-full rounded-lg border-2 border-orange-400 bg-orange-50 px-4 py-2 text-sm font-bold focus:border-orange-600 focus:outline-none";

    const card =
        "rounded-xl border border-slate-300 bg-white p-5 shadow-sm";

    return (
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-50 p-6 shadow-lg">
            <h3 className="mb-8 text-center text-sm font-extrabold uppercase tracking-widest text-orange-600">
                Barras de Remolque
            </h3>

            {/* ================= BARRAS ================= */}
            <div className={`${card} mb-6`}>
                <h4 className="mb-4 text-xs font-bold uppercase text-slate-600">
                    Barras
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <div className={label}>Número total</div>
                        <input
                            className={input}
                            value={form.barrasRemolque.total}
                            onChange={(e) =>
                                updateField("barrasRemolque.total", e.target.value)
                            }
                        />
                    </div>

                    <div>
                        <div className={label}>Limpieza</div>
                        <select
                            className={select}
                            value={form.barrasRemolque.limpieza}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.limpieza",
                                    e.target.value
                                )
                            }
                        >
                            <option value="" disabled>
                                Elija una opción
                            </option>
                            <option>Limpias</option>
                            <option>Sucias</option>
                        </select>
                    </div>

                    <div>
                        <div className={label}>Estado general</div>
                        <select
                            className={select}
                            value={form.barrasRemolque.estado}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.estado",
                                    e.target.value
                                )
                            }
                        >
                            <option value="" disabled>
                                Elija una opción
                            </option>
                            <option>Bien</option>
                            <option>Mal</option>
                        </select>
                    </div>

                    <div>
                        <div className={label}>Total de cabezales</div>
                        <input
                            className={input}
                            value={form.barrasRemolque.cabezales}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.cabezales",
                                    e.target.value
                                )
                            }
                        />
                    </div>

                    <div>
                        <div className={label}>Estado de cabezales</div>
                        <select
                            className={select}
                            value={form.barrasRemolque.cabezalesEstado}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.cabezalesEstado",
                                    e.target.value
                                )
                            }
                        >
                            <option value="" disabled>
                                Elija una opción
                            </option>
                            <option>Bien</option>
                            <option>Mal</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ================= ESCALERAS ================= */}
            <div className={`${card} mb-6`}>
                <h4 className="mb-4 text-xs font-bold uppercase text-slate-600">
                    Escaleras
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <div className={label}>Cantidad</div>
                        <input
                            className={input}
                            value={form.barrasRemolque.escalerasCantidad}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.escalerasCantidad",
                                    e.target.value
                                )
                            }
                        />
                    </div>

                    <div>
                        <div className={label}>Estado</div>
                        <select
                            className={select}
                            value={form.barrasRemolque.escalerasEstado}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.escalerasEstado",
                                    e.target.value
                                )
                            }
                        >
                            <option value="" disabled>
                                Elija una opción
                            </option>
                            <option>Bien</option>
                            <option>Mal</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ================= HAMBURGUESERA ================= */}
            <div className={card}>
                <h4 className="mb-4 text-xs font-bold uppercase text-slate-600">
                    Hamburguesera
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <div className={label}>Limpieza</div>
                        <select
                            className={select}
                            value={form.barrasRemolque.hamburgueseraLimpieza}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.hamburgueseraLimpieza",
                                    e.target.value
                                )
                            }
                        >
                            <option value="" disabled>
                                Elija una opción
                            </option>
                            <option>Limpia</option>
                            <option>Sucia</option>
                        </select>
                    </div>

                    <div>
                        <div className={label}>Llantas</div>
                        <select
                            className={select}
                            value={form.barrasRemolque.hamburgueseraLlantas}
                            onChange={(e) =>
                                updateField(
                                    "barrasRemolque.hamburgueseraLlantas",
                                    e.target.value
                                )
                            }
                        >
                            <option value="" disabled>
                                Elija una opción
                            </option>
                            <option>Bien</option>
                            <option>Mal</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}
