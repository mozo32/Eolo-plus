import { fechaHoy } from '@/lib/fechaHoy';
import { useVentanaDeFecha } from '@/lib/ventanasDeFecha';
import SignaturePad from '@/pages/despacho/components/walkAround/SignaturePad';
import { actualizarRelevo, ErrorDeApi, guardarRelevo } from '@/stores/apiEntregaTurnoSeguridad';
import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import {
    ETIQUETA_SECCION,
    horaAhora,
    ROL_FBO,
    ROL_JEFE_AREA,
    ROL_QUIEN_ENTREGA,
    SECCIONES,
    type DetalleRelevo,
    type FirmaRelevo,
    type PayloadRelevo,
    type PayloadRelevoNuevo,
} from './types';
import FirmaActual from './FirmaActual';

type Props = {
    abierto: boolean;
    relevo: DetalleRelevo | null;
    nombreUsuario: string;
    puedeFirmarJefe: boolean;
    puedeFirmarFbo: boolean;
    onCerrar: () => void;
    onGuardado: () => void;
};

const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

const CAMPO = 'w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-400';
const ETIQUETA = 'mb-1 block text-[10px] font-black uppercase text-slate-500';

function MensajeError({ mensajes }: { mensajes?: string[] }) {
    return mensajes?.[0] ? <p className="mt-1 text-[10px] font-bold text-red-600">{mensajes[0]}</p> : null;
}

/**
 * El contenedor existe solo para que el formulario se monte de nuevo en cada
 * apertura: así el estado nace siempre de `relevo` y no arrastra lo escrito
 * la vez anterior.
 */
export default function FormEntregaTurno(props: Props) {
    if (!props.abierto) {
        return null;
    }

    return <Formulario key={props.relevo?.id ?? 'nuevo'} {...props} />;
}

function Formulario({ relevo, nombreUsuario, puedeFirmarJefe, puedeFirmarFbo, onCerrar, onGuardado }: Props) {
    const [datos, setDatos] = useState({
        fecha: relevo?.fecha ?? fechaHoy(),
        hora: relevo?.hora ?? horaAhora(),
        seccion: relevo?.seccion ?? SECCIONES[0],
        observaciones: relevo?.observaciones ?? '',
    });
    const [firmaQuienEntrega, setFirmaQuienEntrega] = useState('');
    const [firmaJefe, setFirmaJefe] = useState('');
    const [firmaFbo, setFirmaFbo] = useState('');
    const [errores, setErrores] = useState<Record<string, string[]>>({});
    const [guardando, setGuardando] = useState(false);

    // Al editar se le pasa la fecha original: si no, un relevo de hace tres
    // días no se podría ni corregir porque su propia fecha quedaría fuera de
    // la ventana.
    const { min, max } = useVentanaDeFecha('seguridad.entrega_turno', relevo?.fecha);

    const editando = relevo !== null;
    // Al crear la firma de quien entrega es obligatoria; al editar, la que ya hay se conserva.
    const faltaFirma = !editando && firmaQuienEntrega === '';

    /** La firma vigente de un rol, o null si ese rol no ha firmado. */
    const firmaGuardada = (rol: string): FirmaRelevo | null => relevo?.firmas.find((firma) => firma.rol === rol) ?? null;

    const enviar = async (evento: FormEvent) => {
        evento.preventDefault();

        if (guardando || faltaFirma) {
            return;
        }

        setGuardando(true);
        setErrores({});

        try {
            if (relevo === null) {
                const payload: PayloadRelevoNuevo = {
                    fecha_hora: `${datos.fecha} ${datos.hora}:00`,
                    seccion: datos.seccion,
                    observaciones: datos.observaciones.trim() || null,
                    firma_quien_entrega: firmaQuienEntrega,
                };

                await guardarRelevo(payload);
            } else {
                const payload: PayloadRelevo = {
                    fecha_hora: `${datos.fecha} ${datos.hora}:00`,
                    seccion: datos.seccion,
                    observaciones: datos.observaciones.trim() || null,
                    ...(firmaQuienEntrega ? { firma_quien_entrega: firmaQuienEntrega } : {}),
                    ...(puedeFirmarJefe && firmaJefe ? { firma_jefe_area: firmaJefe } : {}),
                    ...(puedeFirmarFbo && firmaFbo ? { firma_fbo: firmaFbo } : {}),
                };

                await actualizarRelevo(relevo.id, payload);
            }

            toast.fire({ icon: 'success', title: editando ? 'Relevo actualizado.' : 'Relevo guardado.' });
            onGuardado();
        } catch (error) {
            if (error instanceof ErrorDeApi) {
                setErrores(error.errors);

                toast.fire({
                    icon: 'error',
                    title:
                        error.status === 403
                            ? 'No tienes permiso para editar este relevo.'
                            : error.status === 404
                              ? 'El relevo ya no existe.'
                              : error.message,
                });

                return;
            }

            toast.fire({ icon: 'error', title: 'No se pudo conectar con el servidor.' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCerrar} />

            <form
                onSubmit={enviar}
                className="relative z-10 flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-black uppercase text-slate-700">{editando ? 'Editar relevo' : 'Nuevo relevo'}</h3>
                    <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 overflow-y-auto p-4">
                    <div>
                        <label className={ETIQUETA}>Entrega</label>
                        <input type="text" value={nombreUsuario} readOnly disabled className={`${CAMPO} bg-slate-100`} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={ETIQUETA}>Fecha</label>
                            <input
                                type="date"
                                value={datos.fecha}
                                min={min}
                                max={max}
                                onChange={(e) => setDatos({ ...datos, fecha: e.target.value })}
                                className={CAMPO}
                                required
                            />
                        </div>
                        <div>
                            <label className={ETIQUETA}>Hora</label>
                            <input
                                type="time"
                                step={60}
                                value={datos.hora}
                                onChange={(e) => setDatos({ ...datos, hora: e.target.value })}
                                className={CAMPO}
                                required
                            />
                        </div>
                        <div className="col-span-2">
                            <MensajeError mensajes={errores.fecha_hora} />
                        </div>
                    </div>

                    <div>
                        <label className={ETIQUETA}>Puesto</label>
                        <div className="flex rounded-lg bg-slate-100 p-1">
                            {SECCIONES.map((seccion) => (
                                <button
                                    key={seccion}
                                    type="button"
                                    onClick={() => setDatos({ ...datos, seccion })}
                                    className={`flex-1 rounded-md py-2 text-[10px] font-bold uppercase transition-all ${
                                        datos.seccion === seccion ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                                    }`}
                                >
                                    {ETIQUETA_SECCION[seccion]}
                                </button>
                            ))}
                        </div>
                        <MensajeError mensajes={errores.seccion} />
                    </div>

                    {relevo !== null && (
                        <div>
                            <label className={ETIQUETA}>
                                Resumen del día{relevo.resumen.congelado ? ' (cerrado)' : ''}
                            </label>
                            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                                {relevo.resumen.renglones.map((renglon) => (
                                    <li key={renglon.clave} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                                        <span className="font-bold text-slate-600">{renglon.titulo}</span>
                                        <span className="text-right text-slate-700">{renglon.texto}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-1 text-[10px] text-slate-500">
                                {relevo.resumen.congelado
                                    ? 'El relevo está firmado por los tres: estas cifras ya no cambian.'
                                    : 'Se cuenta solo, de los registros del día. Se congela cuando entre la tercera firma.'}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className={ETIQUETA}>Observaciones</label>
                        <textarea
                            rows={4}
                            value={datos.observaciones}
                            onChange={(e) => setDatos({ ...datos, observaciones: e.target.value })}
                            className={CAMPO}
                        />
                        <MensajeError mensajes={errores.observaciones} />
                    </div>

                    <div>
                        <FirmaActual firma={firmaGuardada(ROL_QUIEN_ENTREGA)} />
                        <SignaturePad title="Firma de quien entrega" value={firmaQuienEntrega} onChange={setFirmaQuienEntrega} compact />
                        {editando && <p className="mt-1 text-[10px] text-slate-500">Déjala en blanco para conservar la firma actual.</p>}
                        <MensajeError mensajes={errores.firma_quien_entrega} />
                    </div>
                    {/* §5 de la spec: al crear se guarda la firma de quien entrega NADA MÁS. Las dos de cierre entran al editar, sin orden entre ellas, y cada quien ve solo la suya: ofrecer la ajena hace dibujar una firma que el servidor rechaza con 403. */}
                    {editando && puedeFirmarJefe && (
                        <div>
                            <FirmaActual firma={firmaGuardada(ROL_JEFE_AREA)} />
                            <SignaturePad title="Firma del jefe de área" value={firmaJefe} onChange={setFirmaJefe} compact />
                            <MensajeError mensajes={errores.firma_jefe_area} />
                        </div>
                    )}
                    {editando && puedeFirmarFbo && (
                        <div>
                            <FirmaActual firma={firmaGuardada(ROL_FBO)} />
                            <SignaturePad title="Firma del FBO" value={firmaFbo} onChange={setFirmaFbo} compact />
                            <MensajeError mensajes={errores.firma_fbo} />
                        </div>
                    )}
                </div>

                <div className="flex gap-2 border-t border-slate-200 p-4">
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="flex-1 rounded-lg border border-slate-200 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={guardando || faltaFirma}
                        className="flex-1 rounded-lg bg-slate-800 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    );
}
