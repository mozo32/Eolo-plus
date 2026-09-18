import { ArrowDownLeft, ArrowUpRight, CircleCheck, Edit2, Loader2, Plane, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { OperacionPantalla, OperacionProgramada, TipoOperacion } from './types';
import type { TemaPantalla } from './usePantallaTema';

interface Props<T extends OperacionPantalla> {
    tipo: TipoOperacion;
    /** La televisión recibe el subconjunto público; el tablero, la operación completa. */
    operaciones: T[];
    cargando: boolean;
    /**
     * Variante de solo lectura para la televisión: sin ID ni Opciones, con
     * tipografía y filas grandes, encabezado fijo y sin paginación.
     */
    modoPantalla?: boolean;
    /** Solo en modo pantalla: oscuro (predeterminado) o claro. El tablero no lo usa. */
    temaPantalla?: TemaPantalla;
    onEditar?: (operacion: T) => void;
    onEliminar?: (operacion: T) => void;
    /** Finalización manual. Solo se ofrece fuera del modo pantalla. */
    onFinalizar?: (operacion: T) => void;
    /** Ids con una finalización en vuelo: su botón queda deshabilitado. */
    finalizando?: number[];
}

/** Solo el tablero administrativo trae la operación completa. */
const esCompleta = (operacion: OperacionPantalla): operacion is OperacionProgramada =>
    'modulos_usados' in operacion;

const ETIQUETA_MODULO: Record<string, string> = {
    operaciones_diarias: 'Op. Diarias',
    walkaround: 'WalkAround',
};

const POR_PAGINA = 20;

/**
 * Medidas de cada modo. Viven en un objeto para que el JSX siga siendo uno solo
 * y las dos vistas no se separen con el tiempo.
 */
const ESTILOS = {
    admin: {
        seccion: 'space-y-3',
        caja: 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
        scroll: 'overflow-x-auto',
        tabla: 'w-full min-w-[900px] border-collapse text-left',
        cabeceraFila: 'border-b border-slate-100 bg-white',
        th: 'px-6 py-4 text-[9px] font-black uppercase text-slate-400',
        fila: 'border-b border-slate-50 transition-colors hover:bg-slate-50/80',
        celda: 'px-6 py-4',
        matricula: 'text-sm font-black uppercase leading-none tracking-tighter text-slate-800',
        texto: 'text-xs font-bold uppercase text-slate-700',
        hora: 'text-sm font-black text-slate-700',
        observaciones: 'text-xs text-slate-500',
        vacio: 'text-[10px] font-black uppercase tracking-wider text-slate-400',
        vacioIcono: 36,
    },
    pantalla: {
        seccion: 'flex min-h-0 flex-1 flex-col gap-3',
        caja: 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl',
        scroll: 'min-h-0 flex-1 overflow-auto',
        tabla: 'w-full border-collapse text-left',
        cabeceraFila: 'border-b-2 border-slate-700 bg-slate-800',
        th: 'sticky top-0 z-10 bg-slate-800 px-6 py-4 text-lg font-black uppercase tracking-wide text-slate-300',
        fila: 'border-b border-slate-800',
        celda: 'px-6 py-6',
        matricula: 'text-4xl font-black uppercase leading-none tracking-tight text-white',
        texto: 'text-2xl font-bold uppercase text-slate-200',
        hora: 'text-3xl font-black text-white',
        observaciones: 'text-xl text-slate-400',
        vacio: 'text-3xl font-black uppercase tracking-wide text-slate-500',
        vacioIcono: 72,
    },
    // Mismas medidas que `pantalla`, con colores para fondo claro y contraste
    // suficiente para leerse a distancia.
    pantallaClara: {
        seccion: 'flex min-h-0 flex-1 flex-col gap-3',
        caja: 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl',
        scroll: 'min-h-0 flex-1 overflow-auto',
        tabla: 'w-full border-collapse text-left',
        cabeceraFila: 'border-b-2 border-slate-300 bg-slate-100',
        th: 'sticky top-0 z-10 bg-slate-100 px-6 py-4 text-lg font-black uppercase tracking-wide text-slate-600',
        fila: 'border-b border-slate-200',
        celda: 'px-6 py-6',
        matricula: 'text-4xl font-black uppercase leading-none tracking-tight text-slate-900',
        texto: 'text-2xl font-bold uppercase text-slate-700',
        hora: 'text-3xl font-black text-slate-900',
        observaciones: 'text-xl text-slate-500',
        vacio: 'text-3xl font-black uppercase tracking-wide text-slate-400',
        vacioIcono: 72,
    },
} as const;

/** Colores de los elementos de pantalla que no viven en ESTILOS (cabecera, spinner, vacío). */
const ACENTOS_PANTALLA = {
    oscuro: {
        iconoSalida: 'bg-red-500/20 text-red-400',
        iconoLlegada: 'bg-emerald-500/20 text-emerald-400',
        titulo: 'text-3xl font-black uppercase tracking-wide text-white',
        contador: 'rounded-lg bg-slate-700 px-3 py-1 font-mono text-2xl font-bold text-slate-200',
        spinner: 'text-sky-400',
        vacioIcono: 'text-slate-700',
    },
    claro: {
        iconoSalida: 'bg-red-100 text-red-600',
        iconoLlegada: 'bg-emerald-100 text-emerald-600',
        titulo: 'text-3xl font-black uppercase tracking-wide text-slate-900',
        contador: 'rounded-lg bg-slate-200 px-3 py-1 font-mono text-2xl font-bold text-slate-800',
        spinner: 'text-sky-600',
        vacioIcono: 'text-slate-300',
    },
} as const;

/**
 * Una sola tabla para salidas y llegadas: el tipo decide las columnas y el modo
 * decide el tamaño.
 *
 * En modo administrativo usa los estilos de las tablas de WalkAround y
 * Operaciones Diarias, con paginación y columna de opciones. En modo pantalla es
 * de solo lectura y está pensada para leerse a distancia.
 */
export default function TablaOperacionesProgramadas<T extends OperacionPantalla>({
    tipo,
    operaciones,
    cargando,
    modoPantalla = false,
    temaPantalla = 'oscuro',
    onEditar,
    onEliminar,
    onFinalizar,
    finalizando = [],
}: Props<T>) {
    const esSalida = tipo === 'salida';
    const titulo = esSalida ? 'Salidas' : 'Llegadas';
    const Icono = esSalida ? ArrowUpRight : ArrowDownLeft;

    const e = modoPantalla ? (temaPantalla === 'claro' ? ESTILOS.pantallaClara : ESTILOS.pantalla) : ESTILOS.admin;
    const acento = ACENTOS_PANTALLA[temaPantalla];

    // En pantalla no hay ID ni Opciones.
    const columnas = (esSalida ? 9 : 8) - (modoPantalla ? 2 : 0);

    const [pagina, setPagina] = useState(1);

    const totalPaginas = modoPantalla ? 1 : Math.max(1, Math.ceil(operaciones.length / POR_PAGINA));

    // Al cambiar de fecha o de filtro la lista se acorta: no dejar al usuario
    // parado en una página que ya no existe.
    useEffect(() => {
        setPagina(actual => Math.min(actual, totalPaginas));
    }, [totalPaginas]);

    // La televisión muestra el día completo y hace scroll.
    const visibles = useMemo(
        () => (modoPantalla ? operaciones : operaciones.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)),
        [modoPantalla, operaciones, pagina],
    );

    return (
        <section className={e.seccion}>
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className={`rounded-lg ${modoPantalla ? 'p-2.5' : 'p-1.5'} ${
                            modoPantalla
                                ? esSalida
                                    ? acento.iconoSalida
                                    : acento.iconoLlegada
                                : esSalida
                                  ? 'bg-red-100/50 text-red-700'
                                  : 'bg-emerald-50 text-emerald-600'
                        }`}
                    >
                        <Icono size={modoPantalla ? 32 : 16} />
                    </span>

                    <h2
                        className={
                            modoPantalla
                                ? acento.titulo
                                : 'text-[11px] font-black uppercase tracking-tighter text-slate-700'
                        }
                    >
                        {titulo}
                    </h2>

                    <span
                        className={
                            modoPantalla
                                ? acento.contador
                                : 'rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500'
                        }
                    >
                        {operaciones.length}
                    </span>
                </div>
            </header>

            <div className={e.caja}>
                <div className={e.scroll}>
                    <table className={e.tabla}>
                        <thead>
                            <tr className={e.cabeceraFila}>
                                {!modoPantalla && <th className={`${e.th} w-10 px-4 text-center`}>ID</th>}
                                <th className={e.th}>Matrícula</th>
                                <th className={`${e.th} text-center`}>Equipo</th>
                                <th className={`${e.th} text-center`}>Hora</th>
                                <th className={`${e.th} text-center`}>{esSalida ? 'Destino' : 'Origen'}</th>
                                <th className={`${e.th} text-center`}>PAX</th>
                                {esSalida && <th className={`${e.th} text-center`}>FP</th>}
                                <th className={e.th}>Observaciones</th>
                                {!modoPantalla && <th className={`${e.th} text-right`}>Opciones</th>}
                            </tr>
                        </thead>

                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={columnas} className="py-20 text-center">
                                        <Loader2
                                            className={`mx-auto animate-spin ${modoPantalla ? acento.spinner : 'text-indigo-500'}`}
                                            size={modoPantalla ? 64 : 32}
                                        />
                                    </td>
                                </tr>
                            ) : visibles.length === 0 ? (
                                <tr>
                                    <td colSpan={columnas} className="py-20 text-center">
                                        <Plane
                                            className={`mx-auto mb-4 ${modoPantalla ? acento.vacioIcono : 'text-slate-200'}`}
                                            size={e.vacioIcono}
                                        />
                                        <p className={e.vacio}>
                                            {modoPantalla
                                                ? `No hay ${titulo.toLowerCase()} programadas para hoy.`
                                                : `Sin ${titulo.toLowerCase()} programadas para esta fecha`}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                visibles.map(operacion => (
                                    <tr
                                        key={operacion.id}
                                        className={`${e.fila} ${modoPantalla ? '' : 'transition-colors'}`}
                                    >
                                        {!modoPantalla && (
                                            <td className="px-4 py-4 text-center text-[10px] font-bold text-slate-400">
                                                {operacion.id}
                                            </td>
                                        )}

                                        <td className={e.celda}>
                                            <div className="flex items-center gap-3">
                                                {!modoPantalla && (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                                        <Plane size={16} />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className={e.matricula}>{operacion.matricula}</p>
                                                    {!modoPantalla && esCompleta(operacion) && operacion.modulos_usados.length > 0 && (
                                                        <p className="mt-1 text-[9px] font-bold uppercase text-sky-600">
                                                            Usada en{' '}
                                                            {operacion.modulos_usados
                                                                .map(modulo => ETIQUETA_MODULO[modulo] ?? modulo)
                                                                .join(' · ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className={`${e.celda} text-center ${e.texto}`}>{operacion.equipo}</td>

                                        <td className={`${e.celda} text-center`}>
                                            <span className={e.hora}>{operacion.hora}</span>
                                        </td>

                                        <td className={`${e.celda} text-center ${e.texto}`}>
                                            {operacion.lugar || '—'}
                                        </td>

                                        <td className={`${e.celda} text-center ${e.texto}`}>
                                            {operacion.pax ?? '—'}
                                        </td>

                                        {esSalida && (
                                            <td className={`${e.celda} text-center ${e.texto}`}>
                                                {operacion.fp || '—'}
                                            </td>
                                        )}

                                        <td className={`${e.celda} ${e.observaciones}`}>
                                            {operacion.observaciones || '—'}
                                        </td>

                                        {!modoPantalla && (
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    {onFinalizar && (
                                                        <button
                                                            type="button"
                                                            disabled={finalizando.includes(operacion.id)}
                                                            onClick={() => onFinalizar(operacion)}
                                                            title="Finalizar (marcar como realizada sin registro diario)"
                                                            className="p-2 text-slate-400 transition-colors hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            {finalizando.includes(operacion.id) ? (
                                                                <Loader2 size={16} className="animate-spin" />
                                                            ) : (
                                                                <CircleCheck size={16} />
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onEditar?.(operacion)}
                                                        title="Actualizar"
                                                        className="p-2 text-slate-400 transition-colors hover:text-blue-600"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onEliminar?.(operacion)}
                                                        title="Eliminar"
                                                        className="p-2 text-slate-400 transition-colors hover:text-red-600"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!modoPantalla && totalPaginas > 1 && (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-500">
                        PÁGINA {pagina} DE {totalPaginas}
                    </span>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            disabled={pagina === 1}
                            onClick={() => setPagina(pagina - 1)}
                            className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black hover:bg-slate-50 disabled:opacity-50"
                        >
                            ANTERIOR
                        </button>
                        <button
                            type="button"
                            disabled={pagina === totalPaginas}
                            onClick={() => setPagina(pagina + 1)}
                            className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black hover:bg-slate-50 disabled:opacity-50"
                        >
                            SIGUIENTE
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
