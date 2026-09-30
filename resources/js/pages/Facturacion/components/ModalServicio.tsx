import { ErrorApi, type AjustePrecio, type CategoriaServicio, type DatosServicio, type Servicio } from '@/stores/apiFacturacionCatalogos';
import { Save, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import CampoMonto from './CampoMonto';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle, sectionTitle } from './estilos';
import { AJUSTES_PRECIO, MARGEN_MAX, PRECIO_SERVICIO_MAX, formatearMonto, importeVistaPrevia, parsearMonto, sinCerosFinales, validarMonto } from './formato';
import ModalBase from './ModalBase';

const NOMBRE_SERVICIO_MAX = 120;

/** Cero es válido en los dos: los servicios de tercero se teclean al capturar, y un servicio propio no lleva margen. */
const OPCIONES_PRECIO = { nombre: 'el precio unitario', obligatorio: true, decimales: 4, minimo: 0, maximo: PRECIO_SERVICIO_MAX } as const;
const OPCIONES_MARGEN = { nombre: 'el margen', obligatorio: true, decimales: 2, minimo: 0, maximo: MARGEN_MAX } as const;

export interface CategoriasServicio {
    /** Todas, activas y de baja. */
    lista: CategoriaServicio[];
    cargando: boolean;
    error: string | null;
}

interface Props {
    /** null: alta. */
    servicio: Servicio | null;
    categorias: CategoriasServicio;
    onCerrar: () => void;
    /** Guarda. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra los errores por campo. */
    onGuardar: (datos: DatosServicio) => Promise<void>;
}

type Campo = 'categoria_servicio_id' | 'nombre' | 'precio_unitario' | 'es_de_tercero' | 'margen' | 'ajuste_precio';

/**
 * Alta y edición de un servicio: categoría, nombre, precio, si es de tercero,
 * margen y ajuste.
 *
 * Lo que la pantalla hace evidente, sin decidir por el usuario:
 *  - El precio cero es válido: por eso el campo es de texto (CampoMonto) y vacío no es cero.
 *  - "De tercero" y el margen van juntos (de tercero si y solo si el margen es mayor a 0). El formulario lo dice
 *    y avisa cuando la combinación no cuadra, pero no cambia ningún valor: el servidor rechaza con 422 y su
 *    mensaje se muestra tal cual.
 *  - El margen y el ajuste cambian lo que se cobra: al lado de los campos se ve el importe de una unidad (vista previa).
 *  - Una categoría dada de baja no se puede asignar; la que el servicio ya tenía se conserva y se marca "de baja".
 */
export default function ModalServicio({ servicio, categorias, onCerrar, onGuardar }: Props) {
    const inicial = {
        categoria: servicio?.categoria_servicio_id == null ? '' : String(servicio.categoria_servicio_id),
        nombre: servicio?.nombre ?? '',
        precio: servicio ? sinCerosFinales(servicio.precio_unitario) : '',
        esDeTercero: servicio?.es_de_tercero ?? false,
        // Un servicio nuevo no es de tercero: su margen es 0, y se muestra así en vez de dejar el campo vacío.
        margen: servicio ? sinCerosFinales(servicio.margen) : '0',
        ajuste: servicio?.ajuste_precio ?? 'ninguno',
    };

    const [categoria, setCategoria] = useState(inicial.categoria);
    const [nombre, setNombre] = useState(inicial.nombre);
    const [precio, setPrecio] = useState(inicial.precio);
    const [esDeTercero, setEsDeTercero] = useState(inicial.esDeTercero);
    const [margen, setMargen] = useState(inicial.margen);
    const [ajuste, setAjuste] = useState<AjustePrecio>(inicial.ajuste);

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const tieneCambios =
        categoria !== inicial.categoria ||
        nombre !== inicial.nombre ||
        precio !== inicial.precio ||
        esDeTercero !== inicial.esDeTercero ||
        margen !== inicial.margen ||
        ajuste !== inicial.ajuste;

    const limpiarError = (...campos: Campo[]) => setErrores(previos => (campos.some(c => previos[c]) ? { ...previos, ...Object.fromEntries(campos.map(c => [c, undefined])) } : previos));

    // Activas, más la que el servicio ya tiene aunque esté de baja (el servidor la acepta); ninguna otra de baja.
    const actual = servicio?.categoria ?? null;
    const opcionesCategoria = categorias.lista.filter(c => c.status === 'A' || c.id === servicio?.categoria_servicio_id);
    if (actual && !opcionesCategoria.some(c => c.id === actual.id)) opcionesCategoria.push(actual);
    opcionesCategoria.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const precioNumero = validarMonto(precio, OPCIONES_PRECIO) === null ? parsearMonto(precio) : null;
    const margenNumero = validarMonto(margen, OPCIONES_MARGEN) === null ? parsearMonto(margen) : null;
    const importe = precioNumero !== null && margenNumero !== null ? importeVistaPrevia(precioNumero, margenNumero, ajuste) : null;

    // Aviso, no corrección: muestra lo que el servidor va a rechazar, sin tocar lo capturado.
    const acoplamientoDesigual = margenNumero !== null && (esDeTercero ? margenNumero <= 0 : margenNumero > 0);

    const validar = (): Partial<Record<Campo, string>> => {
        const nuevos: Partial<Record<Campo, string>> = {};
        const nombreLimpio = nombre.trim();

        if (nombreLimpio === '') nuevos.nombre = 'El nombre es obligatorio.';
        else if (nombreLimpio.length > NOMBRE_SERVICIO_MAX) nuevos.nombre = `El nombre no puede pasar de ${NOMBRE_SERVICIO_MAX} caracteres.`;

        const errorPrecio = validarMonto(precio, OPCIONES_PRECIO);
        if (errorPrecio) nuevos.precio_unitario = errorPrecio;

        const errorMargen = validarMonto(margen, OPCIONES_MARGEN);
        if (errorMargen) nuevos.margen = errorMargen;

        return nuevos;
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const nuevos = validar();
        setErrores(nuevos);
        setMensajeGeneral(null);
        if (Object.keys(nuevos).length > 0) return;

        setGuardando(true);

        try {
            const precioUnitario = parsearMonto(precio);
            const margenPorcentaje = parsearMonto(margen);

            // Nunca se convierte un vacío en cero: el precio cero es válido y fijaría un cobro sin error en ningún lado.
            if (precioUnitario === null || margenPorcentaje === null) throw new Error('No se pudo leer el precio o el margen. No se guardó nada.');

            await onGuardar({
                categoria_servicio_id: categoria === '' ? null : Number(categoria),
                nombre: nombre.trim(),
                precio_unitario: precioUnitario,
                es_de_tercero: esDeTercero,
                margen: margenPorcentaje,
                ajuste_precio: ajuste,
            });
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                // Se muestra el mensaje del servidor tal cual, campo por campo (incluido el del acoplamiento de tercero y margen).
                setErrores(Object.fromEntries(Object.entries(error.errors).map(([campo, mensajes]) => [campo, mensajes[0]])));
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalBase
            idTitulo="titulo-modal-servicio"
            titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'}
            subtitulo={servicio ? servicio.nombre : 'Captura los datos y guarda'}
            tieneCambios={tieneCambios}
            onCerrar={onCerrar}
            ancho="max-w-2xl"
        >
            <form onSubmit={guardar} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Datos</h4>

                    <div>
                        <label htmlFor="servicio-categoria" className={labelStyle}>
                            Categoría
                        </label>
                        <select
                            id="servicio-categoria"
                            value={categoria}
                            onChange={e => {
                                setCategoria(e.target.value);
                                limpiarError('categoria_servicio_id');
                            }}
                            className={campoConError(!!errores.categoria_servicio_id)}
                            aria-invalid={errores.categoria_servicio_id ? true : undefined}
                        >
                            <option value="">Sin categoría</option>
                            {opcionesCategoria.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}
                                    {c.status === 'N' ? ' (de baja)' : ''}
                                </option>
                            ))}
                        </select>
                        {errores.categoria_servicio_id && <p className={errorStyle}>{errores.categoria_servicio_id}</p>}
                        {categorias.cargando && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Cargando categorías…</p>}
                        {categorias.error && <p className={errorStyle}>No se pudieron cargar las categorías: {categorias.error}</p>}
                        {actual?.status === 'N' && categoria === String(actual.id) && (
                            <p className="mt-1 text-[10px] font-bold text-amber-600 italic">Esta categoría está dada de baja: el servicio la conserva, pero no se puede asignar a otros servicios.</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="servicio-nombre" className={labelStyle}>
                            Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="servicio-nombre"
                            type="text"
                            autoFocus
                            autoComplete="off"
                            maxLength={NOMBRE_SERVICIO_MAX}
                            value={nombre}
                            onChange={e => {
                                setNombre(e.target.value);
                                limpiarError('nombre');
                            }}
                            className={campoConError(!!errores.nombre)}
                            aria-invalid={errores.nombre ? true : undefined}
                        />
                        {errores.nombre && <p className={errorStyle}>{errores.nombre}</p>}
                    </div>

                    <CampoMonto
                        id="servicio-precio"
                        etiqueta="Precio unitario"
                        valor={precio}
                        onChange={valor => {
                            setPrecio(valor);
                            limpiarError('precio_unitario');
                        }}
                        error={errores.precio_unitario}
                        obligatorio
                        ayuda="Hasta 4 decimales. Cero es un precio válido (los servicios de tercero se teclean al capturar); no lo dejes vacío."
                    />
                </div>

                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Tercero, margen y ajuste</h4>
                    <p className="text-[11px] font-semibold text-slate-500">Estos tres datos cambian lo que se cobra.</p>

                    <div>
                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                id="servicio-tercero"
                                type="checkbox"
                                checked={esDeTercero}
                                onChange={e => {
                                    setEsDeTercero(e.target.checked);
                                    limpiarError('es_de_tercero', 'margen');
                                }}
                                className="mt-0.5 h-4 w-4 accent-indigo-600"
                            />
                            <span>
                                <span className="block text-xs font-extrabold uppercase text-slate-600">Es de tercero</span>
                                <span className="block text-[11px] font-semibold text-slate-500">
                                    Lo presta otro proveedor y se cobra con margen. Si lo marcas, captura un margen mayor a 0; si no, el margen es 0.
                                </span>
                            </span>
                        </label>
                        {errores.es_de_tercero && <p className={errorStyle}>{errores.es_de_tercero}</p>}
                    </div>

                    <CampoMonto
                        id="servicio-margen"
                        etiqueta="Margen"
                        valor={margen}
                        onChange={valor => {
                            setMargen(valor);
                            limpiarError('margen');
                        }}
                        error={errores.margen}
                        obligatorio
                        prefijo={null}
                        sufijo="%"
                        placeholder="0"
                        ayuda={esDeTercero ? 'Es de tercero: el margen debe ser mayor a 0.' : 'No es de tercero: el margen debe ser 0.'}
                        pie={
                            acoplamientoDesigual && (
                                <p className="mt-2 flex items-start gap-1.5 text-[11px] font-bold text-amber-700">
                                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                                    {esDeTercero
                                        ? 'Marcaste "Es de tercero" y el margen es 0: el servidor no aceptará esta combinación. Captura un margen mayor a 0 o desmarca "Es de tercero".'
                                        : 'El margen es mayor a 0 y no marcaste "Es de tercero": el servidor no aceptará esta combinación. Marca "Es de tercero" o deja el margen en 0.'}
                                </p>
                            )
                        }
                    />

                    <div>
                        <label htmlFor="servicio-ajuste" className={labelStyle}>
                            Ajuste de precio <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="servicio-ajuste"
                            value={ajuste}
                            onChange={e => {
                                setAjuste(e.target.value as AjustePrecio);
                                limpiarError('ajuste_precio');
                            }}
                            className={campoConError(!!errores.ajuste_precio)}
                            aria-invalid={errores.ajuste_precio ? true : undefined}
                        >
                            {AJUSTES_PRECIO.map(a => (
                                <option key={a.valor} value={a.valor}>
                                    {a.titulo}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-[10px] font-bold text-slate-400 italic">{AJUSTES_PRECIO.find(a => a.valor === ajuste)?.descripcion} El ajuste se aplica antes del margen.</p>
                        {errores.ajuste_precio && <p className={errorStyle}>{errores.ajuste_precio}</p>}
                    </div>

                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3" aria-live="polite">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Vista previa del importe de una unidad</p>
                        <p className="text-2xl font-black text-slate-800">{importe === null ? '—' : formatearMonto(importe)}</p>
                        <p className="mt-1 text-[10px] font-bold text-slate-500 italic">
                            {importe === null
                                ? 'Captura un precio y un margen válidos para ver el importe.'
                                : 'Es el importe que resultaría con lo capturado (ajuste, luego margen), calculado aquí para que se vea su efecto; el sistema calcula la cifra que cobra.'}
                        </p>
                    </div>
                </div>

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                        <Save size={14} />
                        {guardando ? 'GUARDANDO…' : 'GUARDAR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
