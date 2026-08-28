import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import Swal from "sweetalert2";
import { deleteEntregraTurno } from "@/stores/apiEntregarTurno";
import {
    fetchEntregaTurnoDetalle,
    EntregaTurnoDetalle as Detalle,
} from "@/stores/apiEntregarTurno";
import {
    CalendarDays, Clock, UserCheck, UserPlus, ShieldAlert,
    Smartphone, Printer, Wallet, Lock, Trash2, X, FileText
} from "lucide-react";

type Role = { slug: string; nombre: string; };
export type AuthUser = { id: number; name: string; email: string; isAdmin: boolean; roles: Role[]; };
type Props = { id: number; onClose: () => void; onSaved: () => void; };
type PageProps = { auth: { user: AuthUser | null; }; };

export default function EntregarTurnoDetalle({ id, onClose, onSaved }: Props) {
    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [loading, setLoading] = useState(true);
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    useEffect(() => {
        (async () => {
            try {
                const data = await fetchEntregaTurnoDetalle(id);
                setDetalle(data);
            } catch (e: any) {
                Swal.fire("Error", e?.message || "No se pudo cargar el detalle", "error");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p className="font-medium tracking-wide uppercase text-xs">Cargando información…</p>
            </div>
        );
    }

    if (!detalle) {
        return (
            <div className="py-20 flex flex-col items-center text-rose-500">
                <ShieldAlert size={40} className="mb-3 opacity-50" />
                <p className="font-bold tracking-wide uppercase text-sm">No se encontró información</p>
            </div>
        );
    }

    const handleDelete = async () => {
        if (!id) return;
        const r = await Swal.fire({
            icon: "warning",
            title: "¿Eliminar registro?",
            text: "Esta acción no se puede deshacer",
            showCancelButton: true,
            confirmButtonColor: "#e11d48",
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
        });

        if (!r.isConfirmed) return;

        try {
            await deleteEntregraTurno(id);
            Swal.fire("Eliminado", `Registro #${id}`, "success");
            onClose();
            onSaved();
        } catch (e: any) {
            Swal.fire("Error", e?.message || "No se pudo eliminar el registro", "error");
        }
    };

    const fondoDocumentacion = detalle.fondo_documentacion;

    const fondosRegistrados = Array.isArray(
        fondoDocumentacion?.montosAgregados
    )
        ? fondoDocumentacion.montosAgregados
        : Number(
            fondoDocumentacion?.dineroRecibidoContabilidad
        ) > 0
            ? [
                {
                    monto: Number(
                        fondoDocumentacion?.dineroRecibidoContabilidad
                    ),
                    descripcion: "Monto registrado anteriormente",
                },
            ]
            : [];

    const totalFondosRegistrados = fondosRegistrados.reduce(
        (total, fondo) => total + (Number(fondo.monto) || 0),
        0
    );

    return (
        <div className="space-y-6 text-sm text-slate-700 dark:text-slate-200">

            {/* --- DATOS GENERALES --- */}
            <SectionCard title="Datos Generales" icon={<FileText size={18} className="text-indigo-500" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <InfoBox icon={<CalendarDays size={14}/>} label="Fecha" value={detalle.fecha ? new Date(String(detalle.fecha)).toLocaleDateString() : 'N/A'} />
                    <InfoBox icon={<Clock size={14}/>} label="Hora" value={detalle.fecha ? new Date(String(detalle.created_at)).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''} />
                    <InfoBox icon={<UserPlus size={14}/>} label="Quién entrega" value={detalle.nombre_quien_entrega} />
                    <InfoBox icon={<UserCheck size={14}/>} label="Quién recibe" value={detalle.nombre_quien_recibe} />
                    <InfoBox icon={<ShieldAlert size={14}/>} label="Jefe de Área" value={detalle.nombre_jefe_turno_despacho} />
                </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* --- CHECKLIST COMUNICACIÓN --- */}
                <SectionCard title="Checklist de Comunicación" icon={<Smartphone size={18} className="text-emerald-500" />}>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Equipo</th>
                                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Entregado</th>
                                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Cargado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {Object.entries(detalle.checklist_comunicacion?.items || {}).map(([k, v]: any) => (
                                    <tr key={k} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 font-medium">{k}</td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge status={v.entregado ? 'success' : 'danger'}>{v.entregado ? "SÍ" : "NO"}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge status={v.cargado === 'si' ? 'success' : v.cargado === 'no' ? 'danger' : 'neutral'}>{v.cargado || '-'}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {detalle.checklist_comunicacion?.fallas && (
                        <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs">
                            <span className="font-bold uppercase tracking-wider">Fallas reportadas:</span> {detalle.checklist_comunicacion.fallas}
                        </div>
                    )}
                </SectionCard>

                {/* --- COPIADORAS --- */}
                <SectionCard title="Estado de Copiadoras" icon={<Printer size={18} className="text-amber-500" />}>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funciona</p>
                            <Badge status={detalle.copiadoras?.funciona === 'si' ? 'success' : 'danger'}>{detalle.copiadoras?.funciona || 'N/A'}</Badge>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tóner</p>
                            <span className="font-black text-slate-700 uppercase">{detalle.copiadoras?.toner || '-'}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Paquetes</p>
                            {/* Usamos ?? en lugar de || para que respete el 0 */}
                            <span className="font-black text-slate-700 text-lg">{detalle.copiadoras?.paquetes ?? '0'}</span>
                        </div>
                    </div>
                    {detalle.copiadoras?.fallas && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-xs">
                            <span className="font-bold uppercase tracking-wider">Observaciones:</span> {detalle.copiadoras.fallas}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* --- EQUIPO DE OFICINA --- */}
            <SectionCard title="Equipo de Oficina" icon={<Printer size={18} className="text-blue-500" />}>
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Equipo</th>
                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Existencia</th>
                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Entregadas</th>
                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Recibidas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {detalle.equipo_oficina?.map((e, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium">{e.equipo}</td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-600">{e.existencia ?? 0}</td>
                                    <td className="px-4 py-3 text-center font-bold text-indigo-600">{e.entregadas ?? 0}</td>
                                    <td className="px-4 py-3 text-center font-bold text-emerald-600">{e.recibidas ?? 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* --- FONDO DE DOCUMENTACIÓN --- */}
            <SectionCard title="Fondo de Documentación" icon={<Wallet size={18} className="text-teal-500" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Bloque Financiero */}
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1 bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Fondo Recibido</p>
                                <p className="text-2xl font-black text-emerald-700">${detalle.fondo_documentacion?.fondoRecibido ?? 0}</p>
                            </div>
                            <div className="flex-1 bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Fondo Entregado</p>
                                <p className="text-2xl font-black text-indigo-700">${detalle.fondo_documentacion?.fondoEntregado ?? 0}</p>
                            </div>
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Fondos Registrados
                                </p>
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                    Total: ${totalFondosRegistrados}
                                </span>
                            </div>

                            {fondosRegistrados.length > 0 ? (
                                <div className="space-y-2">
                                    {fondosRegistrados.map((fondo, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 shadow-sm"
                                        >
                                            <span className="truncate text-xs font-bold uppercase text-slate-600">
                                                {fondo.descripcion || `Fondo #${i + 1}`}
                                            </span>
                                            <span className="shrink-0 text-sm font-black text-emerald-600">
                                                ${fondo.monto ?? 0}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center text-xs italic text-slate-400">
                                    No hubo fondos adicionales registrados.
                                </p>
                            )}
                        </div>

                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gastos Registrados</p>
                            {detalle.fondo_documentacion?.gastos && detalle.fondo_documentacion.gastos.length > 0 ? (
                                <div className="space-y-2">
                                    {detalle.fondo_documentacion.gastos.map((gasto: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
                                            <span className="text-xs font-bold text-slate-600 uppercase truncate">{gasto.descripcion || 'Sin concepto'}</span>
                                            <span className="text-sm font-black text-rose-600">${gasto.monto ?? 0}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">No hubo gastos registrados.</p>
                            )}
                        </div>
                    </div>

                    {/* Bloque Operativo */}
                    <div className="grid grid-cols-2 gap-4 content-start">
                        <InfoBox label="Vales Gasolina" value={detalle.fondo_documentacion?.cantidadValesGasolina} />
                        <InfoBox label="Reporte Aterrizaje" value={detalle.fondo_documentacion?.reporteAterisaje?.toUpperCase()} />
                        <InfoBox label="Llegadas Operación" value={detalle.fondo_documentacion?.totalLlegadaOperacion} />
                        <InfoBox label="Salidas Operación" value={detalle.fondo_documentacion?.totalSalidaOperacion} />
                        <InfoBox label="Ops. Coordinadas" value={detalle.fondo_documentacion?.cantidadOperacionesCordinadasEntregadas} />
                        <InfoBox label="WalkArounds" value={detalle.fondo_documentacion?.cuantosWalkArounds} />

                        <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Folios Vales de Gasolina</p>
                            {Array.isArray(detalle.fondo_documentacion?.folioValesGasolina) && (detalle.fondo_documentacion!.folioValesGasolina as string[]).length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {(detalle.fondo_documentacion!.folioValesGasolina as string[]).map((folio: string, i: number) => (
                                        <span key={i} className="bg-white border border-slate-200 shadow-sm text-slate-700 px-2 py-1 rounded text-xs font-black uppercase tracking-wider">
                                            #{folio || 'N/A'}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Sin folios registrados</p>
                            )}
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* --- CAJA FUERTE --- (DISEÑO ACTUALIZADO: YA NO ES NEGRO) */}
            <SectionCard title="Estado de Caja Fuerte" icon={<Lock size={18} className="text-slate-500" />}>
                <div className="bg-slate-50 border border-slate-200 text-slate-700 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300 p-4 rounded-xl text-sm shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-400 dark:bg-slate-500"></div>
                    <p className="font-medium leading-relaxed ml-2">
                        {detalle.estado_caja_fuerte || "Sin observaciones registradas."}
                    </p>
                </div>
            </SectionCard>

            {/* --- FOOTER & ACCIONES --- */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-6 mt-4">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider text-center sm:text-left">
                    <p>Creado: <span className="text-slate-600">{detalle.created_at?.split("T")[0]}</span></p>
                    <p>Última act: <span className="text-slate-600">{detalle.updated_at?.split("T")[0]}</span></p>
                </div>

                <div className="flex w-full sm:w-auto gap-3">
                    <button onClick={onClose} className="flex-1 sm:flex-none justify-center flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                        <X size={14} /> Cerrar
                    </button>
                    {user?.isAdmin && (
                        <button onClick={handleDelete} className="flex-1 sm:flex-none justify-center flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-black uppercase text-white hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200">
                            <Trash2 size={14} /> Eliminar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- SUBCOMPONENTES DE DISEÑO ---

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-slate-50/50 dark:bg-slate-800/50 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                {icon}
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    {title}
                </h3>
            </div>
            <div className="p-5">
                {children}
            </div>
        </section>
    );
}

function InfoBox({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) {
    // Verificamos si el valor no es nulo, no es undefined y no es un string vacío.
    // De esta forma, el número 0 pasa como un valor válido y se muestra.
    const hasValue = value !== null && value !== undefined && value !== "";

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {icon} {label}
            </div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate" title={String(value || '')}>
                {hasValue ? value : "-"}
            </p>
        </div>
    );
}

function Badge({ children, status }: { children: React.ReactNode; status: 'success' | 'danger' | 'warning' | 'neutral' }) {
    const styles = {
        success: "bg-emerald-100 text-emerald-700 border-emerald-200",
        danger: "bg-rose-100 text-rose-700 border-rose-200",
        warning: "bg-amber-100 text-amber-700 border-amber-200",
        neutral: "bg-slate-100 text-slate-600 border-slate-200"
    };

    return (
        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${styles[status]}`}>
            {children}
        </span>
    );
}
