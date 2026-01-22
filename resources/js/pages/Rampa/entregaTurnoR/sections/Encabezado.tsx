export default function Encabezado({ form, updateField }: any) {
    const row =
        "grid grid-cols-1 gap-3 items-center md:grid-cols-12";

    const label =
        "md:col-span-4 text-sm font-bold uppercase tracking-wide text-slate-700";

    const input =
        "md:col-span-8 w-full rounded-lg border-2 border-slate-400 bg-slate-100 px-4 py-2 text-base font-bold focus:border-orange-500 focus:bg-white focus:outline-none";

    return (
        <div className="rounded-xl border-2 border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-orange-600">
                Entrega de Turno – Personal de Rampa
            </h2>

            {/* FECHA */}
            <div className={row}>
                <div className={label}>Fecha del turno</div>
                <input
                    type="date"
                    className={input}
                    value={form.encabezado.fecha}
                    onChange={(e) =>
                        updateField("encabezado.fecha", e.target.value)
                    }
                />
            </div>

            {/* JEFE */}
            <div className={`${row} mt-4`}>
                <div className={label}>Jefe de turno</div>
                <input
                    className={input}
                    placeholder="Nombre completo"
                    value={form.encabezado.jefeTurno}
                    onChange={(e) =>
                        updateField("encabezado.jefeTurno", e.target.value)
                    }
                />
            </div>

            {/* NOTA */}
            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-600">
                Registrar correctamente la información del turno antes de continuar
            </div>
        </div>
    );
}
