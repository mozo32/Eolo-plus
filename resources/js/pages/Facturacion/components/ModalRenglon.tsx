import { ErrorApi, apiProveedores, apiServicios, type Proveedor, type Servicio } from '@/stores/apiFacturacionCatalogos';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle, sectionTitle } from './estilos';
import { esConceptoDeEstancia, formatearMonto, importeVistaPrevia } from './formato';
import ModalBase from './ModalBase';

const CANTIDAD_MAX = 9999;
const REMISION_MAX = 255;

export interface DatosRenglon {
    servicio_id: number;
    cantidad: number;
    proveedor_id: number | null;
    remision: string | null;
}

interface Props {
    onCerrar: () => void;
    /** Agrega el renglón. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra los errores por campo. */
    onGuardar: (datos: DatosRenglon) => Promise<void>;
}

type Campo = 'servicio_id' | 'cantidad' | 'proveedor_id' | 'remision';

/**
 * Agregar un servicio a una prefactura: servicio (solo activos, sin los de
 * estancia), cantidad, proveedor y remisión opcionales.
 *
 * El renglón congela el precio, el margen y el ajuste que el servicio tiene hoy.
 * La vista previa del importe es solo eso: se calcula aquí mientras se teclea la
 * cantidad, y la cifra que cuenta (la del renglón y la de los totales) la
 * calcula el servidor al guardar.
 */
export default function ModalRenglon({ onCerrar, onGuardar }: Props) {
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [cargando, setCargando] = useState(true);
    const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);

    const [servicioId, setServicioId] = useState('');
    const [cantidad, setCantidad] = useState('1');
    const [proveedorId, setProveedorId] = useState('');
    const [remision, setRemision] = useState('');

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let vigente = true;

        Promise.all([apiServicios.listar(), apiProveedores.listar()])
            .then(([listaServicios, listaProveedores]) => {
                if (!vigente) return;
                setServicios(listaServicios);
                setProveedores(listaProveedores);
            })
            .catch(e => {
                if (vigente) setErrorCatalogos(e instanceof Error ? e.message : 'Error inesperado');
            })
            .finally(() => {
                if (vigente) setCargando(false);
            });

        return () => {
            vigente = false;
        };
    }, []);

    const opcionesServicio = useMemo(() => servicios.filter(s => s.status === 'A' && !esConceptoDeEstancia(s.concepto)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [servicios]);
    const opcionesProveedor = useMemo(() => proveedores.filter(p => p.status === 'A').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [proveedores]);

    const servicio = opcionesServicio.find(s => String(s.id) === servicioId) ?? null;
    const cantidadNumero = /^\d+$/.test(cantidad.trim()) ? Number(cantidad.trim()) : null;

    // Vista previa: un ajuste desconocido lanza (a propósito: cobrar sin ajuste en silencio sería peor), y aquí se dice.
    let vistaPrevia: { importe: number } | { problema: string } | null = null;
    if (servicio && cantidadNumero !== null && cantidadNumero >= 1 && cantidadNumero <= CANTIDAD_MAX) {
        try {
            vistaPrevia = { importe: importeVistaPrevia(Number(servicio.precio_unitario), Number(servicio.margen), servicio.ajuste_precio, cantidadNumero) };
        } catch {
            vistaPrevia = { problema: 'El ajuste de precio de este servicio no se reconoce: no se puede mostrar la vista previa.' };
        }
    }

    const limpiarError = (campo: Campo) => setErrores(previos => (previos[campo] ? { ...previos, [campo]: undefined } : previos));

    const tieneCambios = servicioId !== '' || cantidad !== '1' || proveedorId !== '' || remision !== '';

    const validar = (): Partial<Record<Campo, string>> => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (servicioId === '') nuevos.servicio_id = 'Elige el servicio que se va a agregar.';

        if (cantidadNumero === null || cantidadNumero < 1) nuevos.cantidad = 'La cantidad debe ser un número entero de al menos 1.';
        else if (cantidadNumero > CANTIDAD_MAX) nuevos.cantidad = 'La cantidad no puede pasar de 9,999.';

        if (remision.trim().length > REMISION_MAX) nuevos.remision = `La remisión no puede pasar de ${REMISION_MAX} caracteres.`;

        return nuevos;
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const nuevos = validar();
        setErrores(nuevos);
        setMensajeGeneral(null);
        if (Object.keys(nuevos).length > 0 || cantidadNumero === null) return;

        setGuardando(true);

        try {
            await onGuardar({
                servicio_id: Number(servicioId),
                cantidad: cantidadNumero,
                proveedor_id: proveedorId === '' ? null : Number(proveedorId),
                remision: remision.trim() === '' ? null : remision.trim(),
            });
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                setErrores(Object.fromEntries(Object.entries(error.errors).map(([campo, mensajes]) => [campo, mensajes[0]])));
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalBase idTitulo="titulo-modal-renglon" titulo="Agregar servicio" subtitulo="Elige el servicio y la cantidad" tieneCambios={tieneCambios} onCerrar={onCerrar} ancho="max-w-xl">
            <form onSubmit={guardar} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Servicio</h4>

                    <div>
                        <label htmlFor="renglon-servicio" className={labelStyle}>
                            Servicio <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="renglon-servicio"
                            autoFocus
                            value={servicioId}
                            onChange={e => {
                                setServicioId(e.target.value);
                                limpiarError('servicio_id');
                            }}
                            className={campoConError(!!errores.servicio_id)}
                            aria-invalid={errores.servicio_id ? true : undefined}
                        >
                            <option value="">Elige un servicio…</option>
                            {opcionesServicio.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.nombre}
                                </option>
                            ))}
                        </select>
                        {errores.servicio_id && <p className={errorStyle}>{errores.servicio_id}</p>}
                        {cargando && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Cargando servicios…</p>}
                        {errorCatalogos && <p className={errorStyle}>No se pudieron cargar los catálogos: {errorCatalogos}</p>}
                        <p className="mt-1 text-[10px] font-bold text-slate-400 italic">
                            Los cargos de estancia no aparecen aquí: los pone «Recalcular estancia», porque su precio sale de la tarifa de la matrícula.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="renglon-cantidad" className={labelStyle}>
                            Cantidad <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="renglon-cantidad"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={cantidad}
                            onChange={e => {
                                setCantidad(e.target.value);
                                limpiarError('cantidad');
                            }}
                            className={campoConError(!!errores.cantidad)}
                            aria-invalid={errores.cantidad ? true : undefined}
                        />
                        {errores.cantidad && <p className={errorStyle}>{errores.cantidad}</p>}
                    </div>

                    <div>
                        <label htmlFor="renglon-proveedor" className={labelStyle}>
                            Proveedor
                        </label>
                        <select
                            id="renglon-proveedor"
                            value={proveedorId}
                            onChange={e => {
                                setProveedorId(e.target.value);
                                limpiarError('proveedor_id');
                            }}
                            className={campoConError(!!errores.proveedor_id)}
                            aria-invalid={errores.proveedor_id ? true : undefined}
                        >
                            <option value="">Sin proveedor</option>
                            {opcionesProveedor.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre}
                                </option>
                            ))}
                        </select>
                        {errores.proveedor_id && <p className={errorStyle}>{errores.proveedor_id}</p>}
                    </div>

                    <div>
                        <label htmlFor="renglon-remision" className={labelStyle}>
                            Remisión
                        </label>
                        <input
                            id="renglon-remision"
                            type="text"
                            autoComplete="off"
                            maxLength={REMISION_MAX}
                            value={remision}
                            onChange={e => {
                                setRemision(e.target.value);
                                limpiarError('remision');
                            }}
                            className={campoConError(!!errores.remision)}
                            aria-invalid={errores.remision ? true : undefined}
                        />
                        {errores.remision && <p className={errorStyle}>{errores.remision}</p>}
                    </div>

                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3" aria-live="polite">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Vista previa del importe</p>
                        <p className="text-2xl font-black text-slate-800">{vistaPrevia && 'importe' in vistaPrevia ? formatearMonto(vistaPrevia.importe) : '—'}</p>
                        <p className="mt-1 text-[10px] font-bold text-slate-500 italic">
                            {vistaPrevia && 'problema' in vistaPrevia
                                ? vistaPrevia.problema
                                : servicio
                                  ? 'Es una vista previa con el precio, el margen y el ajuste del servicio; el sistema calcula la cifra que cobra al agregarlo.'
                                  : 'Elige un servicio y una cantidad para ver el importe.'}
                        </p>
                    </div>
                </div>

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando || cargando} className={BOTON_PRIMARIO}>
                        <Plus size={14} />
                        {guardando ? 'AGREGANDO…' : 'AGREGAR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
