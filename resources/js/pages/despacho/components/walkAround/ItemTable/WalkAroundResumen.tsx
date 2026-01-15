import MapaDanios3D from "../MapaDanios3D";

type Props = {
    data: {
        fecha: string;
        movimiento: string;
        matricula: string;
        tipo: "avion" | "helicoptero";
        tipoAeronave: string;
        hora: string;
        destino: string;
        procedensia: string;
        observaciones: string;
        checklistAvion?: Record<string, any>;
        checklistHelicoptero?: Record<string, any>;
        marcaDanos?: any[];
        fotos?: { url: string }[];
    };
};

function formatFecha(fecha: string) {
    if (!fecha) return "—";
    const iso = fecha.includes("T") ? fecha.split("T")[0] : fecha;
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : fecha;
}

function ChecklistReadonly({ data }: { data?: Record<string, any> }) {
    if (!data || !Object.keys(data).length) {
        return (
            <p className="text-xs text-gray-500">
                No se registró checklist.
            </p>
        );
    }

    return (
        <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(data).map(([key, value]) => {
                const danios = value?.danios ?? [];
                const tieneDanio = danios.length && !danios.includes("sin_danio");

                return (
                    <div
                        key={key}
                        className={`rounded-lg border p-3 text-sm
                            ${tieneDanio
                                ? "border-red-300 bg-red-50"
                                : "border-green-300 bg-green-50"
                            }`}
                    >
                        <div className="mb-1 font-medium capitalize text-gray-800">
                            {key.replaceAll("_", " ")}
                        </div>

                        <div className="flex flex-wrap gap-1">
                            {danios.length ? (
                                danios.map((d: string, i: number) => (
                                    <span
                                        key={i}
                                        className={`rounded-full px-2 py-0.5 text-xs font-semibold
                                            ${d === "sin_danio"
                                                ? "bg-green-200 text-green-800"
                                                : "bg-red-200 text-red-800"
                                            }`}
                                    >
                                        {d.replaceAll("_", " ")}
                                    </span>
                                ))
                            ) : (
                                <span className="rounded-full bg-green-200 px-2 py-0.5 text-xs font-semibold text-green-800">
                                    sin daño
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function WalkAroundResumen({ data }: Props) {
    return (
        <div className="space-y-6">

            <div className="rounded-xl border bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">
                            WalkAround – Revisión
                        </h2>
                        <p className="text-xs text-gray-500">
                            Matrícula: <b>{data.matricula}</b>
                        </p>
                        <p className="text-xs text-gray-500">
                            Tipo de Aeronave: <b>{data.tipoAeronave}</b>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            {data.tipo.toUpperCase()}
                        </span>
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold
                                ${data.movimiento === "entrada"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                        >
                            {data.movimiento.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>

            <section className="rounded-xl border p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">
                    Información general
                </h3>

                <div className="grid gap-3 text-sm md:grid-cols-3">
                    <div><b>Fecha:</b> {formatFecha(data.fecha)}</div>
                    <div><b>Hora:</b> {data.hora || "—"}</div>
                    <div><b>Tipo:</b> {data.tipo}</div>
                    <div><b>Tipo de aeronave:</b> {data.tipoAeronave}</div>
                    <div><b>Destino:</b> {data.destino || "—"}</div>
                    <div><b>Procedencia:</b> {data.procedensia || "—"}</div>
                </div>
            </section>

            <section className="rounded-xl border p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    Observaciones
                </h3>
                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {data.observaciones || "Sin observaciones"}
                </div>
            </section>

            <section className="rounded-xl border p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">
                    Checklist de inspección
                </h3>

                {data.tipo === "avion" && (
                    <ChecklistReadonly data={data.checklistAvion} />
                )}

                {data.tipo === "helicoptero" && (
                    <ChecklistReadonly data={data.checklistHelicoptero} />
                )}
            </section>

            <section className="rounded-xl border p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">
                    Mapa de daños
                </h3>

                {data.marcaDanos?.length ? (
                    <div className="rounded-lg border bg-gray-50 p-2">
                        <MapaDanios3D
                            value={data.marcaDanos}
                            modelSrc={
                                data.tipo === "avion"
                                    ? "/models/Avion.obj"
                                    : "/models/18706 Fighter Helicopter_v1.obj"
                            }
                            readOnly
                        />
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">
                        No señalados.
                    </p>
                )}
            </section>

            {!!data.fotos?.length && (
                <section className="rounded-xl border p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">
                        Evidencia fotográfica
                    </h3>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {data.fotos.map((f, i) => (
                            <img
                                key={i}
                                src={f.url}
                                className="h-28 w-full rounded-lg border object-cover shadow-sm"
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
