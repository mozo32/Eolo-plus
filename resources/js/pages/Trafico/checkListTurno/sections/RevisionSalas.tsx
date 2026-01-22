const SALAS = [
    { id: "aula_1", label: "Aula 1" },
    { id: "aula_2", label: "Aula 2" },
    { id: "sala_pilotos", label: "Sala de Pilotos" },
    { id: "sala_gimnasio", label: "Sala Gimnasio" },
    { id: "oficina_direccion", label: "Oficina Dirección" },
    { id: "salas_juntas_2do_piso", label: "Salas de Juntas 2do Piso" },
    { id: "sala_frente_trafico", label: "Sala Frente a Tráfico" },
    { id: "salas_vip_pax", label: "Salas VIP Pax" },
];

const HORAS = ["07:00", "10:00", "13:00", "16:00", "19:00"];

type Props = {
    form: any;
    updateField: (path: string, value: any) => void;
};

export default function ResibeTurnoCon({ form, updateField }: Props) {

    const toggleCheck = (salaId: string, hora: string) => {
        const actual =
            form.revisionSalas?.[salaId]?.[hora] ?? false;

        updateField(
            `revisionSalas.${salaId}.${hora}`,
            !actual
        );
    };

    return (
        <div className="rounded-xl border border-slate-300 bg-white p-6 shadow">
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-[#00677F]">
                Revisión de Salas
            </h3>
            <p className="mb-4 rounded-md border border-[#00677F] bg-[#E6F2F6] px-4 py-2 text-sm font-medium text-[#004B5C]">
                Se revisa que no haya objetos olvidados, se mantenga el orden y el servicio
                de aguas y cafetería esté completo.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-[#E6F2F6]">
                            <th className="border px-3 py-2 text-left">
                                Sala / Hora
                            </th>
                            {HORAS.map((hora) => (
                                <th
                                    key={hora}
                                    className="border px-3 py-2 text-center font-bold"
                                >
                                    {hora}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {SALAS.map(({ id, label }) => (
                            <tr
                                key={id}
                                className="hover:bg-slate-50"
                            >
                                <td className="border px-3 py-2 font-semibold">
                                    {label}
                                </td>

                                {HORAS.map((hora) => (
                                    <td
                                        key={hora}
                                        className="border px-3 py-2 text-center cursor-pointer"
                                        onClick={() => toggleCheck(id, hora)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!form.revisionSalas?.[id]?.[hora]}
                                            readOnly
                                            className="h-5 w-5 accent-[#00677F] pointer-events-none"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>

                </table>
            </div>
        </div>
    );
}
