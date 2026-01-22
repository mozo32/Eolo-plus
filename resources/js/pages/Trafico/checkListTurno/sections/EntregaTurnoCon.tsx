const EQUIPOS = [
    { id: "areas_limpias", label: "Areas Limpias" },
    { id: "periodicos", label: "Periódicos" },
    { id: "mesa_vip", label: "Mesa VIP Llena" },
    { id: "hielos", label: "Hielos Nuevos" },
    { id: "refrigerador", label: "Refrigerador Surtido" },
    { id: "control_med", label: "Control de Med. Lleno" },
    { id: "coffee_despacho", label: "Coffee B. Despacho" },
    { id: "paraguas", label: "Cantidad de Paraguas" },
    { id: "formatos", label: "Formatos de Turno Llenos" },
    { id: "radios", label: "Radios Cargados" },
    { id: "telefonos", label: "Telefonos Cargados" },
    { id: "cafeteras", label: "Cafeteras Preparadas" },
];

type Props = {
    form: any;
    updateField: (path: string, value: any) => void;
};

export default function EntregaTurnoCon({ form, updateField }: Props) {
    const toggleEquipo = (id: string) => {
        updateField(
            `entregaTurnoCon.${id}`,
            !form.entregaTurnoCon?.[id]
        );
    };

    return (
        <>
            <div className="rounded-xl border-2 border-[#00677F] bg-[#E6F2F6] p-6">
                <h3 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-[#00677F]">
                    Entrega turno con
                </h3>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {EQUIPOS.map(({ id, label }) => (
                        <label
                            key={id}
                            className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
                        >
                            <input
                                type="checkbox"
                                checked={!!form.entregaTurnoCon?.[id]}
                                onChange={() => toggleEquipo(id)}
                                className="h-5 w-5 accent-[#00677F]"
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Observaciones generales
                </label>
                <textarea
                    className="w-full min-h-[140px] rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-medium focus:border-[#00677F] focus:outline-none"
                    value={form.observaciones_entrega}
                    onChange={(e) =>
                        updateField("observaciones_entrega", e.target.value)
                    }
                />
            </div>
        </>
    );
}

