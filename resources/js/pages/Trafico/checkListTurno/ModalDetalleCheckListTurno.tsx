import React from "react";
import { X } from "lucide-react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    loading?: boolean;
};

const GREEN_INST = "#003E51";

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

const getArray = (value: any) => {
    const parsed = parseJson(value);
    return Array.isArray(parsed) ? parsed : [];
};

const getObject = (value: any) => {
    const parsed = parseJson(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const formatFecha = (fecha?: string) => {
    if (!fecha) return "N/A";

    const base = fecha.includes("T") ? fecha.split("T")[0] : fecha;
    const [y, m, d] = base.split("-");

    if (!y || !m || !d) return fecha;

    return `${d}/${m}/${y}`;
};

const cleanLabel = (value: string) => {
    return String(value || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatBool = (value: any) => {
    return value ? "SI" : "NO";
};

const boolColor = (value: any) => {
    return value ? "text-[#003E51]" : "text-red-500";
};

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-4 border border-black bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-800">
            {children}
        </div>
    );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-4 border-l border-b border-black">
            {children}
        </div>
    );
}

function InfoCell({
    label,
    value,
    className = "",
}: {
    label: string;
    value: any;
    className?: string;
}) {
    return (
        <div className={`border-r border-t border-black p-2 ${className}`}>
            <p className="mb-1 text-[8px] uppercase text-slate-600">{label}</p>
            <p className="text-[11px] font-black text-slate-900">{value ?? "-"}</p>
        </div>
    );
}

function CheckGroup({ title, value }: { title: string; value: any }) {
    const obj = getObject(value);
    const entries = Object.entries(obj);

    return (
        <div className="break-inside-avoid">
            <SectionTitle>{title}</SectionTitle>

            {entries.length === 0 ? (
                <div className="border-x border-b border-black px-2 py-2 text-[10px] font-bold text-slate-500">
                    SIN INFORMACIÓN
                </div>
            ) : (
                <div className="grid grid-cols-4 border-l border-b border-black">
                    {entries.map(([key, val]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between gap-2 border-r border-t border-black px-2 py-2"
                        >
                            <span className="text-[8px] uppercase text-slate-600">
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
    const logoUrl = `${window.location.origin}/54657b8c-8428-41cc-a654-794ca81943d6.jpg`;

    const cantidadNacionales =
        data?.cantidad_operaciones_nacionales ??
        data?.cantidad_nacionales ??
        0;

    const cantidadInternacionales =
        data?.cantidad_operaciones_internacionales ??
        data?.cantidad_internacionales ??
        0;

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
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto bg-slate-200 p-6">
                    {loading ? (
                        <div className="mx-auto flex h-96 w-full max-w-[794px] items-center justify-center bg-white shadow-2xl">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Cargando información...
                            </p>
                        </div>
                    ) : !data ? (
                        <div className="mx-auto flex h-96 w-full max-w-[794px] items-center justify-center bg-white shadow-2xl">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                No se encontró información
                            </p>
                        </div>
                    ) : (
                        <div className="mx-auto min-h-[1123px] w-full max-w-[794px] bg-white px-[40px] pb-[70px] pt-[34px] text-slate-900 shadow-2xl">
                            <div className="relative min-h-[1015px]">
                                <img
                                    src={watermarkUrl}
                                    alt=""
                                    className="pointer-events-none absolute left-1/2 top-[180px] z-0 h-[500px] w-[500px] -translate-x-1/2 object-contain opacity-[0.05]"
                                />

                                <div className="relative z-10">
                                    <div className="mb-3 flex border-2 border-black">
                                        <div className="flex w-[140px] items-center justify-center p-[5px]">
                                            <img
                                                src={logoUrl}
                                                alt="EOLO"
                                                className="h-[45px] w-full object-contain"
                                            />
                                        </div>

                                        <div className="flex flex-1 flex-col justify-center px-[15px] py-[10px]">
                                            <h1 className="text-[14px] font-black uppercase text-slate-900">
                                                Entrega de Turno - Operaciones
                                            </h1>
                                            <p className="mt-1 text-[9px] text-slate-600">
                                                ID Registro: {data?.id ?? "-"} | Fecha: {formatFecha(data?.fecha)}
                                            </p>
                                            <p className="mt-1 text-[9px] text-slate-600">
                                                Responsable: {data?.nombre_empleado ?? "-"}
                                            </p>
                                        </div>
                                    </div>

                                    <SectionTitle>Información del Turno</SectionTitle>
                                    <div className="grid grid-cols-2 border-l border-b border-black">
                                        <InfoCell
                                            label="Responsable"
                                            value={data?.nombre_empleado ?? "-"}
                                        />
                                        <InfoCell
                                            label="Fecha"
                                            value={formatFecha(data?.fecha)}
                                        />
                                    </div>

                                    <SectionTitle>Resumen de Operaciones</SectionTitle>
                                    <InfoGrid>
                                        <InfoCell
                                            label="Total Operaciones"
                                            value={data?.cantidad_operaciones ?? 0}
                                        />
                                        <InfoCell
                                            label="Nacionales"
                                            value={cantidadNacionales}
                                        />
                                        <InfoCell
                                            label="Internacionales"
                                            value={cantidadInternacionales}
                                        />
                                        <InfoCell
                                            label="Equipaje"
                                            value={data?.cantidad_equipaje ?? 0}
                                        />
                                        <InfoCell
                                            label="Total Pasajeros"
                                            value={data?.cantidad_pasajeros ?? 0}
                                            className="col-span-2"
                                        />
                                        <InfoCell
                                            label="Folio"
                                            value={`#${data?.id ?? "-"}`}
                                            className="col-span-2"
                                        />
                                    </InfoGrid>

                                    <SectionTitle>Tipo de Cliente</SectionTitle>
                                    <InfoGrid>
                                        <InfoCell
                                            label="Tránsito"
                                            value={data?.cantidad_transito ?? 0}
                                        />
                                        <InfoCell
                                            label="Guarda"
                                            value={data?.cantidad_guarda ?? 0}
                                        />
                                        <InfoCell
                                            label="Aerotaxi"
                                            value={data?.cantidad_aerotaxi ?? 0}
                                        />
                                        <InfoCell
                                            label="Mantenimiento"
                                            value={data?.cantidad_mantenimiento ?? 0}
                                        />
                                        <InfoCell
                                            label="Handling"
                                            value={data?.cantidad_handling ?? 0}
                                            className="col-span-4"
                                        />
                                    </InfoGrid>

                                    <SectionTitle>Cumplimiento de Obligaciones</SectionTitle>
                                    <div className="grid grid-cols-3 border-l border-b border-black">
                                        <div className="border-r border-t border-black p-2">
                                            <p className="mb-1 text-[8px] uppercase text-slate-600">
                                                Revisión Base Operaciones
                                            </p>
                                            <p className={`text-[11px] font-black ${boolColor(data?.revision_base_operaciones)}`}>
                                                {formatBool(data?.revision_base_operaciones)}
                                            </p>
                                        </div>

                                        <div className="border-r border-t border-black p-2">
                                            <p className="mb-1 text-[8px] uppercase text-slate-600">
                                                Informe Diario
                                            </p>
                                            <p className={`text-[11px] font-black ${boolColor(data?.envia_informe_diario)}`}>
                                                {formatBool(data?.envia_informe_diario)}
                                            </p>
                                        </div>

                                        <div className="border-r border-t border-black p-2">
                                            <p className="mb-1 text-[8px] uppercase text-slate-600">
                                                Resumen Semanal
                                            </p>
                                            <p className={`text-[11px] font-black ${boolColor(data?.envia_resumen_semanal)}`}>
                                                {formatBool(data?.envia_resumen_semanal)}
                                            </p>
                                        </div>
                                    </div>

                                    <CheckGroup
                                        title="Recepción de Turno"
                                        value={recibeTurnoCon}
                                    />

                                    <div className="break-inside-avoid">
                                        <SectionTitle>Revisión de Salas / Aulas</SectionTitle>

                                        <div className="border-l border-t border-black">
                                            <div className="grid grid-cols-[50%_50%] border-b border-black bg-slate-50">
                                                <div className="border-r border-black px-2 py-2 text-[8px] font-black uppercase">
                                                    Ubicación
                                                </div>
                                                <div className="border-r border-black px-2 py-2 text-[8px] font-black uppercase">
                                                    Horarios Revisados
                                                </div>
                                            </div>

                                            {Object.entries(revisionSalas).length > 0 ? (
                                                Object.entries(revisionSalas).map(([sala, horarios]: any, idx) => {
                                                    const horariosActivos = Object.entries(horarios || {})
                                                        .filter(([, activo]) => activo)
                                                        .map(([hora]) => cleanLabel(hora));

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="grid grid-cols-[50%_50%] border-b border-black"
                                                        >
                                                            <div className="border-r border-black px-2 py-2 text-[9px] font-bold">
                                                                {cleanLabel(sala)}
                                                            </div>
                                                            <div className="border-r border-black px-2 py-2 text-[9px]">
                                                                {horariosActivos.length ? horariosActivos.join(", ") : "-"}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="border-b border-r border-black px-2 py-2 text-[9px] font-bold text-slate-500">
                                                    Sin registros de revisión de salas.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {hotTrasComiCoor.length > 0 && (
                                        <div className="break-inside-avoid">
                                            <SectionTitle>
                                                Hotelería, Traslados, Comidas y Coordinación
                                            </SectionTitle>

                                            <div className="border-l border-t border-black">
                                                <div className="grid grid-cols-[18%_30%_22%_30%] border-b border-black bg-slate-50">
                                                    <div className="border-r border-black px-2 py-2 text-[8px] font-black uppercase">
                                                        Matrícula
                                                    </div>
                                                    <div className="border-r border-black px-2 py-2 text-[8px] font-black uppercase">
                                                        Descripción
                                                    </div>
                                                    <div className="border-r border-black px-2 py-2 text-[8px] font-black uppercase">
                                                        Fecha / Hora
                                                    </div>
                                                    <div className="border-r border-black px-2 py-2 text-[8px] font-black uppercase">
                                                        Notas
                                                    </div>
                                                </div>

                                                {hotTrasComiCoor.map((item: any, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        className="grid grid-cols-[18%_30%_22%_30%] border-b border-black"
                                                    >
                                                        <div className="border-r border-black px-2 py-2 text-[9px] font-bold">
                                                            {item?.matricula || "-"}
                                                        </div>
                                                        <div className="border-r border-black px-2 py-2 text-[9px]">
                                                            {item?.descripcion || "-"}
                                                        </div>
                                                        <div className="border-r border-black px-2 py-2 text-[9px]">
                                                            {`${formatFecha(item?.fecha)} ${item?.hora || ""}`}
                                                        </div>
                                                        <div className="border-r border-black px-2 py-2 text-[9px]">
                                                            {item?.notas || "-"}
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

                                    <SectionTitle>Observaciones</SectionTitle>
                                    <div className="border-l border-b border-black">
                                        <div className="border-r border-t border-black p-2">
                                            <p className="mb-1 text-[8px] uppercase text-slate-600">
                                                Observaciones al Recibir
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-800">
                                                {data?.observaciones_recibe || "Sin observaciones al recibir."}
                                            </p>
                                        </div>

                                        <div className="border-r border-t border-black p-2">
                                            <p className="mb-1 text-[8px] uppercase text-slate-600">
                                                Observaciones al Entregar
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-800">
                                                {data?.observaciones_entrega || "Sin observaciones al entregar."}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-10 flex justify-around gap-8">
                                        {firmas.length > 0 ? (
                                            firmas.map((firma: any, index: number) => (
                                                <div
                                                    key={firma?.id ?? index}
                                                    className="w-[30%] text-center"
                                                >
                                                    {(firma?.url || firma?.path) && (
                                                        <img
                                                            src={firma?.url || `${window.location.origin}/storage/${firma?.path}`}
                                                            alt={firma?.tag || "Firma"}
                                                            className="mx-auto h-[55px] w-[120px] object-contain"
                                                        />
                                                    )}

                                                    <div className="mx-auto mb-2 mt-1 h-px w-full bg-black" />

                                                    <p className="text-[8px] uppercase text-slate-600">
                                                        {firma?.tag || "Firma Autorizada"}
                                                    </p>

                                                    <p className="text-[9px] font-bold uppercase text-slate-900">
                                                        {(data?.nombre_empleado || "________________").toUpperCase()}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="w-[30%] text-center">
                                                <div className="mx-auto h-[55px] w-[120px]" />

                                                <div className="mx-auto mb-2 mt-1 h-px w-full bg-black" />

                                                <p className="text-[8px] uppercase text-slate-600">
                                                    Firma Autorizada
                                                </p>

                                                <p className="text-[9px] font-bold uppercase text-slate-900">
                                                    {(data?.nombre_empleado || "________________").toUpperCase()}
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
                        type="button"
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
