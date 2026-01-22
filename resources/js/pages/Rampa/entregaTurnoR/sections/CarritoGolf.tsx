export default function CarritoGolf({ form, updateField }: any) {
    const ids = ["005"];

    const input =
        "w-full rounded-lg border-2 border-slate-400 bg-slate-100 px-3 py-2 text-sm font-bold focus:border-orange-500 focus:bg-white focus:outline-none";

    return (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-6 border-b pb-2 text-sm font-bold uppercase text-orange-600">
                Carrito de Golf
            </h3>

            <div className="space-y-4">
                {ids.map((id) => (
                    <div
                        key={id}
                        className="rounded-lg border-2 border-slate-300 bg-slate-50 p-4"
                    >
                        {/* HEADER */}
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-700">
                                Carrito {id}
                            </span>
                        </div>

                        {/* CAMPOS */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
                            <div>
                                <label className="label">Carga</label>
                                <input
                                    className={input}
                                    value={form.carritoGolf[id].carga}
                                    onChange={(e) =>
                                        updateField(
                                            `carritoGolf.${id}.carga`,
                                            e.target.value
                                        )
                                    }
                                />
                            </div>

                            <div>
                                <label className="label">Limpieza</label>
                                <select
                                    className={input}
                                    value={form.carritoGolf[id].limpieza}
                                    onChange={(e) =>
                                        updateField(
                                            `carritoGolf.${id}.limpieza`,
                                            e.target.value
                                        )
                                    }
                                >
                                    <option value="">Elija una opción</option>
                                    <option>Limpio</option>
                                    <option>Sucio</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Llantas</label>
                                <select
                                    className={input}
                                    value={form.carritoGolf[id].llantas}
                                    onChange={(e) =>
                                        updateField(
                                            `carritoGolf.${id}.llantas`,
                                            e.target.value
                                        )
                                    }
                                >
                                    <option value="">Elija una opción</option>
                                    <option>Bien</option>
                                    <option>Mal</option>
                                </select>
                            </div>

                            {/* NUEVO CAMPO LUCES */}
                            <div>
                                <label className="label">Luces</label>
                                <select
                                    className={input}
                                    value={form.carritoGolf[id].luces}
                                    onChange={(e) =>
                                        updateField(
                                            `carritoGolf.${id}.luces`,
                                            e.target.value
                                        )
                                    }
                                >
                                    <option value="">Elija una opción</option>
                                    <option>Bien</option>
                                    <option>Mal</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Frenos</label>
                                <select
                                    className={input}
                                    value={form.carritoGolf[id].frenos}
                                    onChange={(e) =>
                                        updateField(
                                            `carritoGolf.${id}.frenos`,
                                            e.target.value
                                        )
                                    }
                                >
                                    <option value="">Elija una opción</option>
                                    <option>Bien</option>
                                    <option>Mal</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="label">Observaciones</label>
                                <input
                                    className={input}
                                    value={form.carritoGolf[id].obs}
                                    onChange={(e) =>
                                        updateField(
                                            `carritoGolf.${id}.obs`,
                                            e.target.value
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
