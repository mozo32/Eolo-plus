import { useState } from "react";
import { buscarUsuariosApi } from "@/stores/apiEntregaTurnoR";

export default function Encabezado({ form, updateField }: any) {
    // Clases de diseño reutilizables
    const row = "grid grid-cols-1 gap-4 items-center md:grid-cols-12 mb-4";
    const label = "md:col-span-4 text-xs font-bold uppercase tracking-wider text-slate-500";
    const input = "md:col-span-8 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100";

    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [buscando, setBuscando] = useState(false);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            {/* TÍTULO */}
            <div className="mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-800">
                    Entrega de Turno
                    <span className="ml-2 text-blue-500 font-medium text-sm block md:inline uppercase">Personal de Rampa</span>
                </h2>
            </div>

            {/* FECHA */}
            <div className={row}>
                <label className={label}>Fecha del turno</label>
                <input
                    type="date"
                    className={input}
                    value={form.encabezado.fecha}
                    onChange={(e) => updateField("encabezado.fecha", e.target.value)}
                />
            </div>

            {/* JEFE */}
            <div className={row}>
                <label className={label}>Jefe de turno</label>
                <div className="md:col-span-8 relative">
                    <input
                        className={input}
                        placeholder="Escriba para buscar..."
                        value={form.encabezado.jefeTurno}
                        onChange={async (e) => {
                            const value = e.target.value;
                            updateField("encabezado.jefeTurno", value);

                            if (value.length < 2) {
                                setUsuarios([]);
                                return;
                            }

                            setBuscando(true);
                            try {
                                const data = await buscarUsuariosApi(value);
                                setUsuarios(data);
                            } finally {
                                setBuscando(false);
                            }
                        }}
                    />

                    {/* DROPDOWN DE BÚSQUEDA */}
                    {usuarios.length > 0 && (
                        <ul className="absolute left-0 right-0 z-50 mt-2 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black ring-opacity-5">
                            {usuarios.map((u) => (
                                <li
                                    key={u.id}
                                    onClick={() => {
                                        updateField("encabezado.jefeTurno", u.name);
                                        setUsuarios([]);
                                    }}
                                    className="group cursor-pointer rounded-lg px-4 py-3 transition-colors hover:bg-blue-50"
                                >
                                    <div className="text-sm font-bold text-slate-700 group-hover:text-blue-700">{u.name}</div>
                                    <div className="text-xs text-slate-400">
                                        {u.clave} <span className="mx-1 text-slate-300">•</span> {u.puesto}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {buscando && (
                        <div className="absolute right-3 top-3 flex items-center gap-2">
                             <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
                             <span className="text-[10px] font-bold uppercase text-blue-400">Buscando</span>
                        </div>
                    )}
                </div>
            </div>

            {/* NOTA INFORMATIVA */}
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-blue-50/50 p-4 border border-blue-100">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-xs font-semibold text-blue-700/80">
                    Por favor, verifique que los datos del jefe de turno y la fecha sean correctos antes de proceder.
                </p>
            </div>
        </div>
    );
}
