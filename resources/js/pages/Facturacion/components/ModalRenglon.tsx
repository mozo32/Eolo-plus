import { ErrorApi, FILTROS_AERONAVES_VACIOS, apiProveedores, apiServicios, obtenerAeronavesFacturablesApi, type AeronaveFacturable, type Proveedor, type Servicio } from '@/stores/apiFacturacionCatalogos';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle, sectionTitle } from './estilos';
import { esConceptoDeEstancia, formatearMonto, importeVistaPrevia } from './formato';
import ModalBase from './ModalBase';

const CANTIDAD_MAX = 9999;
const REMISION_MAX = 255;
const ESPERA_AERONAVE_MS = 300;
const MAXIMO_AERONAVES = 20;

/** Los tres tramos SI se pueden agregar, a nombre de otra aeronave; los dos ajustes no. */
const CONCEPTOS_DE_TRANSITO = ['estancia_transito_2h', 'estancia_transito_12h', 'estancia_pernocta'];

const esTramoDeTransito = (concepto: string | null | undefined): boolean => typeof concepto === 'string' && CONCEPTOS_DE_TRANSITO.includes(concepto);

/**
 * TEMPORAL: el alta se dejó con los campos del sistema viejo, así que Proveedor no se pinta y
 * viaja en null. La remisión SI se captura: el departamento la quiere aunque no se diga de qué
 * proveedor.
 *
 * No se borró nada: el estado, la validación y el envío siguen enteros, y el backend acepta
 * `proveedor_id` como opcional. Poner esto en `true` devuelve el campo tal cual estaba. En los
 * datos de hoy hay 12 renglones con proveedor, capturados antes de ocultarlo; esos conservan el
 * suyo, pero mientras esté en `false` no se pueden capturar nuevos desde aquí.
 */
const MUESTRA_PROVEEDOR = false;

/** Valor del menú de categoría para los servicios que no tienen una activa. */
const SIN_CATEGORIA = 'sin-categoria';

/**
 * La categoría de un servicio PARA ESTE MENU: la suya si está activa, y si no, el cajón de los
 * sueltos. Asi ningun servicio activo se vuelve inalcanzable por no tener categoria o por
 * tenerla dada de baja, que es lo unico que el paso nuevo podria romper.
 */
const claveDeCategoria = (servicio: Servicio): string => (servicio.categoria !== null && servicio.categoria.status === 'A' ? String(servicio.categoria.id) : SIN_CATEGORIA);

export interface DatosRenglon {
    servicio_id: number;
    cantidad: number;
    proveedor_id: number | null;
    remision: string | null;
    /** Solo en los tres tramos de tránsito: la aeronave cuya tarifa se cobra. */
    aeronave_id: number | null;
}

interface Props {
    onCerrar: () => void;
    /** Agrega el renglón. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra los errores por campo. */
    onGuardar: (datos: DatosRenglon) => Promise<void>;
}

type Campo = 'servicio_id' | 'cantidad' | 'proveedor_id' | 'remision' | 'aeronave_id';

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

    const [categoriaId, setCategoriaId] = useState('');
    const [servicioId, setServicioId] = useState('');
    const [cantidad, setCantidad] = useState('1');
    const [proveedorId, setProveedorId] = useState('');
    const [remision, setRemision] = useState('');

    const [busquedaAeronave, setBusquedaAeronave] = useState('');
    const [aeronaves, setAeronaves] = useState<AeronaveFacturable[]>([]);
    const [aeronaveElegida, setAeronaveElegida] = useState<AeronaveFacturable | null>(null);
    const [errorAeronave, setErrorAeronave] = useState<string | null>(null);
    const [buscandoAeronave, setBuscandoAeronave] = useState(false);

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

    const opcionesServicio = useMemo(() => servicios.filter(s => s.status === 'A' && (!esConceptoDeEstancia(s.concepto) || esTramoDeTransito(s.concepto))).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [servicios]);
    const opcionesProveedor = useMemo(() => proveedores.filter(p => p.status === 'A').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [proveedores]);

    /**
     * Las categorías salen de los propios servicios, no del catálogo: así solo se ofrecen las que
     * de verdad tienen algo que elegir, y no hay forma de entrar en una y encontrarla vacía.
     */
    const opcionesCategoria = useMemo(() => {
        const porClave = new Map<string, string>();

        for (const servicio of opcionesServicio) {
            const clave = claveDeCategoria(servicio);

            if (! porClave.has(clave)) {
                porClave.set(clave, clave === SIN_CATEGORIA ? 'Sin categoría' : (servicio.categoria?.nombre ?? 'Sin categoría'));
            }
        }

        // Alfabético, y «Sin categoría» al final: es el cajón de los sueltos, no una categoría más.
        return [...porClave.entries()]
            .map(([clave, nombre]) => ({ clave, nombre }))
            .sort((a, b) => (a.clave === SIN_CATEGORIA ? 1 : b.clave === SIN_CATEGORIA ? -1 : a.nombre.localeCompare(b.nombre, 'es')));
    }, [opcionesServicio]);

    const serviciosDeLaCategoria = useMemo(() => (categoriaId === '' ? [] : opcionesServicio.filter(s => claveDeCategoria(s) === categoriaId)), [opcionesServicio, categoriaId]);

    const servicio = opcionesServicio.find(s => String(s.id) === servicioId) ?? null;
    const cantidadNumero = /^\d+$/.test(cantidad.trim()) ? Number(cantidad.trim()) : null;

    const pideMatricula = esTramoDeTransito(servicio?.concepto);

    useEffect(() => {
        if (! pideMatricula) return;

        let vigente = true;

        const temporizador = setTimeout(async () => {
            setBuscandoAeronave(true);

            try {
                const pagina = await obtenerAeronavesFacturablesApi({ ...FILTROS_AERONAVES_VACIOS, q: busquedaAeronave }, 1, MAXIMO_AERONAVES);
                if (!vigente) return;
                setAeronaves(pagina.data);
                setErrorAeronave(null);
            } catch (e) {
                if (!vigente) return;
                setAeronaves([]);
                setErrorAeronave(e instanceof Error ? e.message : 'No se pudieron cargar las aeronaves.');
            } finally {
                if (vigente) setBuscandoAeronave(false);
            }
        }, busquedaAeronave === '' ? 0 : ESPERA_AERONAVE_MS);

        return () => {
            vigente = false;
            clearTimeout(temporizador);
        };
    }, [busquedaAeronave, pideMatricula]);

    /** La tarifa EFECTIVA del tramo —propia o heredada de la categoría—, ya resuelta por el servidor. */
    const tarifaDelTramo = (aeronave: AeronaveFacturable, concepto: string | null | undefined): string | null =>
        concepto === 'estancia_transito_2h' ? aeronave.tarifa_transito_2h_efectiva
            : concepto === 'estancia_transito_12h' ? aeronave.tarifa_transito_12h_efectiva
                : concepto === 'estancia_pernocta' ? aeronave.tarifa_pernocta_efectiva
                    : null;

    // En un tránsito ajeno el precio NO es el del catálogo —ahí vale 99.00, que es relleno— sino
    // la tarifa de la aeronave elegida. Es el mismo precio que el servidor va a cobrar.
    const precioEfectivo = pideMatricula
        ? (aeronaveElegida === null ? null : tarifaDelTramo(aeronaveElegida, servicio?.concepto))
        : (servicio?.precio_unitario ?? null);

    // Vista previa: un ajuste desconocido lanza (a propósito: cobrar sin ajuste en silencio sería peor), y aquí se dice.
    let vistaPrevia: { importe: number } | { problema: string } | null = null;
    if (servicio && pideMatricula && aeronaveElegida !== null && precioEfectivo === null) {
        vistaPrevia = { problema: 'Esta aeronave no tiene tarifa para ese tramo, ni propia ni por su categoría: no hay precio que cobrar.' };
    } else if (servicio && precioEfectivo !== null && cantidadNumero !== null && cantidadNumero >= 1 && cantidadNumero <= CANTIDAD_MAX) {
        try {
            // El ajeno no lleva margen ni ajuste del catálogo: su precio es la tarifa de la aeronave, y el servidor lo cobra así.
            vistaPrevia = {
                importe: pideMatricula
                    ? importeVistaPrevia(Number(precioEfectivo), 0, 'ninguno', cantidadNumero)
                    : importeVistaPrevia(Number(precioEfectivo), Number(servicio.margen), servicio.ajuste_precio, cantidadNumero),
            };
        } catch {
            vistaPrevia = { problema: 'El ajuste de precio de este servicio no se reconoce: no se puede mostrar la vista previa.' };
        }
    }

    const limpiarError = (campo: Campo) => setErrores(previos => (previos[campo] ? { ...previos, [campo]: undefined } : previos));

    const tieneCambios = categoriaId !== '' || servicioId !== '' || cantidad !== '1' || proveedorId !== '' || remision !== '' || aeronaveElegida !== null;

    const validar = (): Partial<Record<Campo, string>> => {
        const nuevos: Partial<Record<Campo, string>> = {};

        // El aviso apunta al paso que falta: decir «elige el servicio» con el menu deshabilitado
        // manda al usuario a un campo que no puede tocar.
        if (categoriaId === '') nuevos.servicio_id = 'Elige primero la categoría del servicio.';
        else if (servicioId === '') nuevos.servicio_id = 'Elige el servicio que se va a agregar.';

        if (pideMatricula && aeronaveElegida === null) nuevos.aeronave_id = 'Elige la aeronave cuyo tránsito se va a cobrar.';

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
                aeronave_id: pideMatricula ? (aeronaveElegida?.aeronave_id ?? null) : null,
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

    // El elegido va primero aunque esta busqueda no lo traiga: si no, el menu se ve vacio
    // mientras el cobro sigue apuntando a esa aeronave.
    const opcionesAeronave = [
        ...(aeronaveElegida !== null && ! aeronaves.some(a => a.aeronave_id === aeronaveElegida.aeronave_id) ? [aeronaveElegida] : []),
        ...aeronaves,
    ];

    return (
        <ModalBase idTitulo="titulo-modal-renglon" titulo="Agregar servicio" subtitulo="Elige el servicio y la cantidad" tieneCambios={tieneCambios} onCerrar={onCerrar} ancho="max-w-xl">
            <form onSubmit={guardar} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Servicio</h4>

                    <div>
                        <label htmlFor="renglon-categoria" className={labelStyle}>
                            Categoría <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="renglon-categoria"
                            autoFocus
                            value={categoriaId}
                            onChange={e => {
                                setCategoriaId(e.target.value);
                                // El servicio elegido era de la categoria anterior: se limpia para que
                                // no se cuele uno que ya no esta a la vista.
                                setServicioId('');
                                setAeronaveElegida(null);
                                setBusquedaAeronave('');
                                limpiarError('servicio_id');
                                limpiarError('aeronave_id');
                            }}
                            className={campoConError(false)}
                        >
                            <option value="">Elige una categoría…</option>
                            {opcionesCategoria.map(c => (
                                <option key={c.clave} value={c.clave}>
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="renglon-servicio" className={labelStyle}>
                            Servicio <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="renglon-servicio"
                            value={servicioId}
                            disabled={categoriaId === ''}
                            onChange={e => {
                                setServicioId(e.target.value);
                                setAeronaveElegida(null);
                                setBusquedaAeronave('');
                                limpiarError('servicio_id');
                                limpiarError('aeronave_id');
                            }}
                            className={campoConError(!!errores.servicio_id)}
                            aria-invalid={errores.servicio_id ? true : undefined}
                        >
                            <option value="">{categoriaId === '' ? 'Elige primero una categoría…' : 'Elige un servicio…'}</option>
                            {serviciosDeLaCategoria.map(s => (
                                <option key={s.id} value={s.id}>
                                    {esTramoDeTransito(s.concepto) ? `${s.nombre} — según la aeronave` : `${s.nombre} — ${formatearMonto(s.precio_unitario)}`}
                                </option>
                            ))}
                        </select>
                        {errores.servicio_id && <p className={errorStyle}>{errores.servicio_id}</p>}
                        {cargando && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Cargando servicios…</p>}
                        {errorCatalogos && <p className={errorStyle}>No se pudieron cargar los catálogos: {errorCatalogos}</p>}
                        <p className="mt-1 text-[10px] font-bold text-slate-400 italic">
                            Los tránsitos de OTRA aeronave se agregan aquí, con su matrícula. La estancia de la aeronave de esta prefactura sale de «Estancia y ajustes», que la calcula con su tarifa.
                        </p>
                    </div>

                    {pideMatricula && (
                        <div>
                            <label htmlFor="renglon-aeronave" className={labelStyle}>
                                Matrícula de la aeronave <span className="text-red-500">*</span>
                            </label>
                            <p className="mb-1 text-[10px] font-bold text-slate-400 italic">El precio sale de la tarifa de ESTA aeronave, no del catálogo.</p>
                            <input
                                type="text"
                                value={busquedaAeronave}
                                onChange={e => setBusquedaAeronave(e.target.value)}
                                placeholder="Buscar matrícula…"
                                autoComplete="off"
                                className="mb-2 w-full text-[11px] border border-slate-200 p-2 rounded bg-white outline-none focus:border-blue-400"
                                aria-label="Buscar matrícula"
                            />
                            <select
                                id="renglon-aeronave"
                                value={aeronaveElegida === null ? '' : String(aeronaveElegida.aeronave_id)}
                                onChange={e => {
                                    setAeronaveElegida(opcionesAeronave.find(a => String(a.aeronave_id) === e.target.value) ?? null);
                                    limpiarError('aeronave_id');
                                }}
                                className={campoConError(!!errores.aeronave_id)}
                                aria-invalid={errores.aeronave_id ? true : undefined}
                            >
                                <option value="">Elige la aeronave…</option>
                                {opcionesAeronave.map(a => (
                                    <option key={a.aeronave_id} value={a.aeronave_id}>
                                        {a.matricula ?? `Aeronave ${a.aeronave_id}`}
                                    </option>
                                ))}
                            </select>
                            {buscandoAeronave && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Buscando…</p>}
                            {errorAeronave && <p className={errorStyle}>{errorAeronave}</p>}
                            {!buscandoAeronave && !errorAeronave && aeronaves.length === MAXIMO_AERONAVES && (
                                <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Se muestran los primeros {MAXIMO_AERONAVES}; escribe más para acotar.</p>
                            )}
                            {!buscandoAeronave && !errorAeronave && busquedaAeronave !== '' && aeronaves.length === 0 && (
                                <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Ninguna aeronave coincide.</p>
                            )}
                            {errores.aeronave_id && <p className={errorStyle}>{errores.aeronave_id}</p>}
                        </div>
                    )}

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

                    {MUESTRA_PROVEEDOR && (
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
                    )}

                    <div>
                        <label htmlFor="renglon-remision" className={labelStyle}>
                            No. Remisión
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
