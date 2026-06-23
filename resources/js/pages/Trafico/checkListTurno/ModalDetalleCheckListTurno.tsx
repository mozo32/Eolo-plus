import { X } from "lucide-react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    loading?: boolean;
};

const GREEN = "#003E51";

const parseJson = (value: any) => {
    if (!value) return value;

    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    return value;
};

const formatFecha = (fecha?: string) => {
    if (!fecha) return "N/A";

    const base = fecha.includes("T") ? fecha.split("T")[0] : fecha;
    const [y, m, d] = base.split("-");

    if (!y || !m || !d) return fecha;

    return `${d}/${m}/${y}`;
};

const formatBool = (value: any) => {
    return value ? "SI" : "NO";
};

const boolColor = (value: any) => {
    return value ? "text-emerald-600" : "text-red-600";
};

const cleanLabel = (value: string) => {
    return String(value || "")
        .replace(/_/g, " ")
        .toUpperCase();
};

const getArray = (value: any) => {
    const parsed = parseJson(value);
    return Array.isArray(parsed) ? parsed : [];
};

const getObject = (value: any) => {
    const parsed = parseJson(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h4
            className="mb-2 mt-4 border-b pb-1 text-[11px] font-black uppercase"
            style={{ color: GREEN, borderColor: GREEN }}
        >
            {children}
        </h4>
    );
}

function CheckGroup({ title, value }: { title: string; value: any }) {
    const obj = getObject(value);
    const entries = Object.entries(obj);

    return (
        <div className="break-inside-avoid">
            <SectionTitle>{title}</SectionTitle>

            {entries.length === 0 ? (
                <div className="border border-black px-2 py-2 text-[10px] font-bold text-slate-500">
                    SIN INFORMACIÓN
                </div>
            ) : (
                <div className="grid grid-cols-4 border-l border-t border-black">
                    {entries.map(([key, val]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between gap-2 border-b border-r border-black px-2 py-2"
                        >
                            <span className="text-[9px] uppercase text-slate-600">
                                {cleanLabel(key)}
                            </span>
                            <span className={`text-[10px] font-black ${boolColor(val)}`}>
                                {formatBool(val)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ModalDetalleCheckListTurno({
    isOpen,
    onClose,
    data,
    loading = false,
}: Props) {
    if (!isOpen) return null;

    const recibeTurnoCon = getObject(data?.recibe_turno_con);
    const revisionSalas = getObject(data?.revision_salas);
    const hotTrasComiCoor = getArray(data?.hot_tras_comi_coor);
    const entregaTurnoCon = getObject(data?.entrega_turno_con);
    const firmas = Array.isArray(data?.firmas) ? data.firmas : [];

    const watermarkUrl = `${window.location.origin}/1c463caa-e3a1-4093-a00b-1c0da40795f6.jpg`;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
                    <div>
                        <h3 className="text-sm font-black uppercase text-slate-800">
                            Vista previa del PDF
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Checklist de entrega de turno
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto bg-slate-200 p-6">
                    {loading ? (
                        <div className="flex h-96 items-center justify-center bg-white">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Cargando información...
                            </p>
                        </div>
                    ) : !data ? (
                        <div className="flex h-96 items-center justify-center bg-white">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                No se encontró información
                            </p>
                        </div>
                    ) : (
                        <div className="mx-auto min-h-[1123px] w-full max-w-[794px] bg-white p-[34px] text-slate-900 shadow-2xl">
                            <div className="relative min-h-[1055px]">
                                <img
                                    src={watermarkUrl}
                                    alt=""
                                    className="pointer-events-none absolute left-1/2 top-[170px] w-[420px] -translate-x-1/2 opacity-10"
                                />

                                <div className="relative z-10">
                                    <div className="mb-3 flex border-2 border-black">
                                        <div
                                            className="flex w-[125px] items-center justify-center py-5 text-white"
                                            style={{ backgroundColor: GREEN }}
                                        >
                                            <span className="text-[24px] font-black tracking-[0.25em]">
                                                EOLO
                                            </span>
                                        </div>

                                        <div className="flex flex-1 flex-col justify-center px-4 py-3">
                                            <h1 className="mb-1 text-[15px] font-black uppercase">
                                                Checklist de Entrega de Turno
                                            </h1>
                                            <p className="text-[10px] text-slate-600">
                                                Folio: #{data.id} · Fecha: {formatFecha(data.fecha)}
                                            </p>
                                            <p className="text-[10px] text-slate-600">
                                                Responsable: {data.nombre_empleado || "N/A"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mb-2 grid grid-cols-2 gap-3">
                                        <div className="border border-black p-2 text-center">
                                            <p className="text-[9px] uppercase text-slate-600">
                                                Operaciones
                                            </p>
                                            <p className="text-[18px] font-black">
                                                {data.cantidad_operaciones ?? "0"}
                                            </p>
                                        </div>

                                        <div className="border border-black p-2 text-center">
                                            <p className="text-[9px] uppercase text-slate-600">
                                                Pasajeros
                                            </p>
                                            <p className="text-[18px] font-black">
                                                {data.cantidad_pasajeros ?? "0"}
                                            </p>
                                        </div>
                                    </div>

                                    <SectionTitle>Cumplimiento de Obligaciones</SectionTitle>

                                    <div className="mb-3 grid grid-cols-4 border-l border-t border-black">
                                        <div className="flex items-center justify-between border-b border-r border-black px-2 py-2">
                                            <span className="text-[9px] uppercase text-slate-600">
                                                Revisión Base Op.
                                            </span>
                                            <span
                                                className={`text-[10px] font-black ${boolColor(
                                                    data.revision_base_operaciones
                                                )}`}
                                            >
                                                {formatBool(data.revision_base_operaciones)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between border-b border-r border-black px-2 py-2">
                                            <span className="text-[9px] uppercase text-slate-600">
                                                Informe Diario
                                            </span>
                                            <span
                                                className={`text-[10px] font-black ${boolColor(
                                                    data.envia_informe_diario
                                                )}`}
                                            >
                                                {formatBool(data.envia_informe_diario)}
                                            </span>
                                        </div>

                                        <div className="col-span-2 flex items-center justify-between border-b border-r border-black px-2 py-2">
                                            <span className="text-[9px] uppercase text-slate-600">
                                                Resumen Semanal
                                            </span>
                                            <span
                                                className={`text-[10px] font-black ${boolColor(
                                                    data.envia_resumen_semanal
                                                )}`}
                                            >
                                                {formatBool(data.envia_resumen_semanal)}
                                            </span>
                                        </div>
                                    </div>

                                    <CheckGroup
                                        title="Recepción de Turno"
                                        value={recibeTurnoCon}
                                    />

                                    <div className="break-inside-avoid">
                                        <SectionTitle>Revisión de Salas / Aulas</SectionTitle>

                                        <div className="border border-black">
                                            <div className="grid grid-cols-[60%_40%] border-b border-black bg-slate-100">
                                                <div className="border-r border-black px-2 py-2 text-center text-[9px] font-black uppercase">
                                                    Ubicación
                                                </div>
                                                <div className="px-2 py-2 text-center text-[9px] font-black uppercase">
                                                    Horarios Revisados
                                                </div>
                                            </div>

                                            {Object.entries(revisionSalas).length > 0 ? (
                                                Object.entries(revisionSalas).map(
                                                    ([sala, horarios]: any, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="grid grid-cols-[60%_40%] border-b border-black last:border-b-0"
                                                        >
                                                            <div className="border-r border-black px-2 py-2 text-[9px] uppercase">
                                                                {cleanLabel(sala)}
                                                            </div>
                                                            <div className="px-2 py-2 text-center text-[9px]">
                                                                {horarios && typeof horarios === "object"
                                                                    ? Object.keys(horarios).join(", ")
                                                                    : "N/A"}
                                                            </div>
                                                        </div>
                                                    )
                                                )
                                            ) : (
                                                <div className="px-2 py-2 text-center text-[9px] font-bold text-slate-500">
                                                    SIN INFORMACIÓN
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {hotTrasComiCoor.length > 0 && (
                                        <div className="break-inside-avoid">
                                            <SectionTitle>
                                                Hotelería, Traslados y Comidas
                                            </SectionTitle>

                                            <div className="border border-black">
                                                <div className="grid grid-cols-[20%_30%_25%_25%] border-b border-black bg-slate-100">
                                                    <div className="border-r border-black px-2 py-2 text-center text-[9px] font-black uppercase">
                                                        Matrícula
                                                    </div>
                                                    <div className="border-r border-black px-2 py-2 text-center text-[9px] font-black uppercase">
                                                        Descripción
                                                    </div>
                                                    <div className="border-r border-black px-2 py-2 text-center text-[9px] font-black uppercase">
                                                        Fecha / Hora
                                                    </div>
                                                    <div className="px-2 py-2 text-center text-[9px] font-black uppercase">
                                                        Notas
                                                    </div>
                                                </div>

                                                {hotTrasComiCoor.map((item: any, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        className="grid grid-cols-[20%_30%_25%_25%] border-b border-black last:border-b-0"
                                                    >
                                                        <div className="border-r border-black px-2 py-2 text-center text-[9px]">
                                                            {item.matricula || "N/A"}
                                                        </div>
                                                        <div className="border-r border-black px-2 py-2 text-center text-[9px]">
                                                            {item.descripcion || "-"}
                                                        </div>
                                                        <div className="border-r border-black px-2 py-2 text-center text-[9px]">
                                                            {`${item.fecha || ""} ${item.hora || ""}`}
                                                        </div>
                                                        <div className="px-2 py-2 text-center text-[9px]">
                                                            {item.notas || "Sin notas"}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <CheckGroup
                                        title="Entrega de Turno"
                                        value={entregaTurnoCon}
                                    />

                                    <div className="mt-4 break-inside-avoid border border-black bg-slate-50 p-3">
                                        <p className="mb-2 text-[9px] font-black uppercase">
                                            Observaciones de Turno
                                        </p>

                                        <p className="text-[10px] text-slate-700">
                                            {data.observaciones_recibe
                                                ? `AL RECIBIR: ${data.observaciones_recibe}`
                                                : "SIN OBSERVACIONES AL RECIBIR."}
                                        </p>

                                        <p className="mt-2 text-[10px] text-slate-700">
                                            {data.observaciones_entrega
                                                ? `AL ENTREGAR: ${data.observaciones_entrega}`
                                                : "SIN OBSERVACIONES AL ENTREGAR."}
                                        </p>
                                    </div>

                                    <div className="mt-12 flex justify-around gap-8">
                                        {firmas.length > 0 ? (
                                            firmas.map((f: any, index: number) => (
                                                <div
                                                    key={f.id ?? index}
                                                    className="w-[180px] border-t border-black pt-2 text-center"
                                                >
                                                    {f.url && (
                                                        <img
                                                            src={f.url}
                                                            alt={f.tag || "Firma"}
                                                            className="mx-auto mb-1 h-[60px] w-[130px] object-contain"
                                                        />
                                                    )}
                                                    <p className="text-[9px] uppercase text-slate-600">
                                                        {f.tag || "Firma"}
                                                    </p>
                                                    <p className="text-[9px] font-black uppercase">
                                                        {data.nombre_empleado || "N/A"}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="w-[180px] border-t border-black pt-2 text-center">
                                                <p className="text-[9px] uppercase text-slate-600">
                                                    Firma
                                                </p>
                                                <p className="text-[9px] font-black uppercase">
                                                    {data.nombre_empleado || "N/A"}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-3">
                    <button
                        onClick={onClose}
                        className="rounded bg-slate-800 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-700"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
