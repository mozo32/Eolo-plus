export default function Encabezado({ form, updateField }: any) {
    return (
        <div className="rounded-xl border bg-gray-50 p-6">
            <h2 className="mb-6 text-center text-xl font-bold uppercase">
                Entrega de Turnos – Personal de Rampa
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                    type="date"
                    className="input"
                    value={form.encabezado.fecha}
                    onChange={(e) =>
                        updateField("encabezado.fecha", e.target.value)
                    }
                />

                <input
                    className="input"
                    placeholder="Jefe de Turno"
                    value={form.encabezado.jefeTurno}
                    onChange={(e) =>
                        updateField("encabezado.jefeTurno", e.target.value)
                    }
                />
            </div>
        </div>
    );
}
