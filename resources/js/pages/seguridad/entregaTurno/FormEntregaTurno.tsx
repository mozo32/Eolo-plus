import { fechaHoy } from '@/lib/fechaHoy';
import { useVentanaDeFecha } from '@/lib/ventanasDeFecha';
import SignaturePad from '@/pages/despacho/components/walkAround/SignaturePad';
import { actualizarRelevo, ErrorDeApi, guardarRelevo } from '@/stores/apiEntregaTurnoSeguridad';
import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import {
    CASILLAS,
    ETIQUETA_CASILLA,
    ETIQUETA_PERNOCTA,
    ETIQUETA_SECCION,
    horaAhora,
    PERNOCTA,
    ROL_FBO,
    ROL_QUIEN_ENTREGA,
    SECCIONES,
    type Casilla,
    type DetalleRelevo,
    type FirmaRelevo,
    type PayloadRelevo,
    type PayloadRelevoNuevo,
    type Pernocta,
    type Seccion,
} from './types';
import FirmaActual from './FirmaActual';

type Props = {
    abierto: boolean;
    relevo: DetalleRelevo | null;
    nombreUsuario: string;
    puedeFirmarComoFbo: boolean;
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

function Formulario({ relevo, nombreUsuario, puedeFirmarComoFbo, onCerrar, onGuardado }: Props) {
    const [datos, setDatos] = useState({
        fecha: relevo?.fecha ?? fechaHoy(),
        hora: relevo?.hora ?? horaAhora(),
        seccion: relevo?.seccion ?? ('frente' as Seccion),
        pernocta_mensual: relevo?.pernocta_mensual ?? ('R' as Pernocta),
        observaciones: relevo?.observaciones ?? '',
        casillas: Object.fromEntries(CASILLAS.map((casilla) => [casilla, relevo?.[casilla] ?? false])) as Record<Casilla, boolean>,
    });
    const [firmaQuienEntrega, setFirmaQuienEntrega] = useState('');
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

    const alternar = (casilla: Casilla) =>
        setDatos((previo) => ({ ...previo, casillas: { ...previo.casillas, [casilla]: !previo.casillas[casilla] } }));

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
                    ...datos.casillas,
                    fecha_hora: `${datos.fecha} ${datos.hora}:00`,
                    seccion: datos.seccion,
                    pernocta_mensual: datos.pernocta_mensual,
                    observaciones: datos.observaciones.trim() || null,
                    firma_quien_entrega: firmaQuienEntrega,
                };

                await guardarRelevo(payload);
            } else {
                const payload: PayloadRelevo = {
                    ...datos.casillas,
                    fecha_hora: `${datos.fecha} ${datos.hora}:00`,
                    seccion: datos.seccion,
                    pernocta_mensual: datos.pernocta_mensual,
                    observaciones: datos.observaciones.trim() || null,
                    ...(firmaQuienEntrega ? { firma_quien_entrega: firmaQuienEntrega } : {}),
                    ...(puedeFirmarComoFbo && firmaFbo ? { firma_fbo: firmaFbo } : {}),
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

                    <div>
                        <label className={ETIQUETA}>Apartados</label>
                        <div className="grid grid-cols-2 gap-2">
                            {CASILLAS.map((casilla) => (
                                <label key={casilla} className="inline-flex items-center gap-2 text-xs text-gray-800">
                                    <input
                                        type="checkbox"
                                        checked={datos.casillas[casilla]}
                                        onChange={() => alternar(casilla)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span>{ETIQUETA_CASILLA[casilla]}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={ETIQUETA}>Pernocta mensual</label>
                        <div className="flex gap-4">
                            {PERNOCTA.map((estado) => (
                                <label key={estado} className="inline-flex items-center gap-2 text-xs text-gray-800">
                                    <input
                                        type="radio"
                                        name="pernocta_mensual"
                                        checked={datos.pernocta_mensual === estado}
                                        onChange={() => setDatos({ ...datos, pernocta_mensual: estado })}
                                        className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span>{ETIQUETA_PERNOCTA[estado]}</span>
                                </label>
                            ))}
                        </div>
                        <MensajeError mensajes={errores.pernocta_mensual} />
                    </div>

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
                    {/* §4 de la spec: al crear se guarda la firma de quien entrega NADA MÁS; el FBO firma después, por la cola de pendientes. Ofrecer aquí su pad le hacía dibujar una firma que `store` descartaba al validar, con un 201 de «relevo registrado correctamente» encima. */}
                    {editando && puedeFirmarComoFbo && (
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
