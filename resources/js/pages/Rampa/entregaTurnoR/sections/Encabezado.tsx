import { useState } from "react";
import { buscarUsuariosApi } from "@/stores/apiEntregaTurnoR";

export default function Encabezado({ form, updateField }: any) {
    const row =
        "grid grid-cols-1 gap-3 items-center md:grid-cols-12";

    const label =
        "md:col-span-4 text-sm font-bold uppercase tracking-wide text-slate-700";

    const input =
        "md:col-span-8 w-full rounded-lg border-2 border-slate-400 bg-slate-100 px-4 py-2 text-base font-bold focus:border-orange-500 focus:bg-white focus:outline-none";
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [bloqueado, setBloqueado] = useState(false);
    const [buscando, setBuscando] = useState(false);
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

                <div className="md:col-span-8 relative">
                    <input
                        className={input}
                        placeholder="Nombre completo"
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

                    {usuarios.length > 0 && (
                        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-auto rounded-md border bg-white shadow-lg">
                            {usuarios.map((u) => (
                                <li
                                    key={u.id}
                                    onClick={() => {
                                        updateField("encabezado.jefeTurno", u.name);
                                        setUsuarios([]);
                                    }}
                                    className="cursor-pointer px-4 py-2 text-sm hover:bg-orange-50"
                                >
                                    <div className="font-semibold">{u.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {u.clave} · {u.puesto}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {buscando && (
                        <div className="absolute right-3 top-3 text-xs text-slate-400">
                            Buscando...
                        </div>
                    )}
                </div>
            </div>

            {/* NOTA */}
            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-600">
                Registrar correctamente la información del turno antes de continuar
            </div>
        </div>
    );
}
