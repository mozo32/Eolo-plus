export default function Vehiculos({ form, updateField }: any) {
    const unidades = [
        { key: "nissan012", label: "Nissan 012", type: "PickUp" },
        { key: "nissan015", label: "Nissan 015", type: "PickUp" },
        { key: "tractor005", label: "Tractor 005", type: "Heavy" },
        { key: "lektro003", label: "Lektro 003", type: "Electric" },
        { key: "lektro007", label: "Lektro 007", type: "Electric" },
    ];

    // Estilo ultra-limpio sin bordes pesados
    const inputStyle = `
    w-full bg-slate-50 border-transparent rounded-md px-2 py-2 text-xs font-bold
    text-slate-700 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-emerald-500/20
    focus:border-emerald-500 outline-none transition-all
  `;

    return (
        <div className="bg-slate-50/50 p-4 md:p-8 rounded-[2rem]">
            {/* Header Estilo App */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                        Vehículos <span className="text-emerald-600"> Equipo Terrestre</span>
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">Control preventivo de unidades terrestres</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-white rounded-full shadow-sm text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100">
                        Total: {unidades.length + 1} Unidades
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {unidades.map((u) => (
                    <div
                        key={u.key}
                        className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                        {/* Top Info */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                                    {u.label.substring(0, 1)}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-700 leading-none">{u.label}</h4>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{u.type}</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                            </div>
                        </div>

                        {/* Grid de Controles Compacto */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Limpieza</p>
                                <select
                                    className={inputStyle}
                                    value={form.vehiculos[u.key].limpieza}
                                    onChange={(e) => updateField(`vehiculos.${u.key}.limpieza`, e.target.value)}
                                >
                                    <option value="">-</option>
                                    <option>Limpio</option>
                                    <option>Sucio</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Combustible</p>
                                <input
                                    className={inputStyle}
                                    placeholder="Nivel"
                                    value={form.vehiculos[u.key].nivel}
                                    onChange={(e) => updateField(`vehiculos.${u.key}.nivel`, e.target.value)}
                                />
                            </div>
                            <div className="col-span-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Llantas</p>
                                <select
                                    className={inputStyle}
                                    value={form.vehiculos[u.key].llantas}
                                    onChange={(e) => updateField(`vehiculos.${u.key}.llantas`, e.target.value)}
                                >
                                    <option value="">-</option>
                                    <option>Bien</option>
                                    <option>Mal</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Frenos</p>
                                <select
                                    className={inputStyle}
                                    value={form.vehiculos[u.key].frenos}
                                    onChange={(e) => updateField(`vehiculos.${u.key}.frenos`, e.target.value)}
                                >
                                    <option value="">-</option>
                                    <option>Bien</option>
                                    <option>Mal</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Luces</p>
                                <select
                                    className={inputStyle}
                                    value={form.vehiculos[u.key].luces}
                                    onChange={(e) => updateField(`vehiculos.${u.key}.luces`, e.target.value)}
                                >
                                    <option value="">-</option>
                                    <option>Bien</option>
                                    <option>Mal</option>
                                </select>
                            </div>
                            <div className="col-span-1 flex items-end">
                                <input
                                    className={`${inputStyle} italic font-normal`}
                                    placeholder="Obs..."
                                    value={form.vehiculos[u.key].obs}
                                    onChange={(e) => updateField(`vehiculos.${u.key}.obs`, e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                ))}

                {/* AGUAS NEGRAS - TARIFA DE COLOR ESPECIAL */}
                <div className="col-span-1 xl:col-span-2 bg-slate-900 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl">
                    <div className="shrink-0">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-white font-black text-xl">08</span>
                        </div>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                        <div>
                            <h4 className="text-white font-bold text-lg">Unidad de Servicio Sanitario</h4>
                            <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Aguas Negras 008</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <select
                                className="bg-slate-800 border-none rounded-xl text-white text-xs p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.vehiculos.aguasNegras008.limpieza}
                                onChange={(e) => updateField("vehiculos.aguasNegras008.limpieza", e.target.value)}
                            >
                                <option value="">Limpieza</option>
                                <option>Limpio</option>
                                <option>Sucio</option>
                            </select>
                            <select
                                className="bg-slate-800 border-none rounded-xl text-white text-xs p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.vehiculos.aguasNegras008.llantas}
                                onChange={(e) => updateField("vehiculos.aguasNegras008.llantas", e.target.value)}
                            >
                                <option value="">Llantas</option>
                                <option>Bien</option>
                                <option>Mal</option>
                            </select>
                            <input
                                className="bg-slate-800 border-none rounded-xl text-white text-xs p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Observaciones de la unidad..."
                                value={form.vehiculos.aguasNegras008.obs}
                                onChange={(e) => updateField("vehiculos.aguasNegras008.obs", e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
