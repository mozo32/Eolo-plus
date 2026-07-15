import React, { useCallback, useEffect, useState } from 'react';
import {
    Archive,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Filter,
    History,
    PackagePlus,
    Pill,
    RotateCcw,
    Search,
    SlidersHorizontal,
    UserPlus,
    X,
} from 'lucide-react';
import { ViewType, Medicamento } from './types';
import InventoryTable from './InventoryTable';
import ActionForms from './ActionForms';
import {
    fetchMedicamentos,
    movimientos as fetchMovimientos,
    fetchCierresMedicamento,
} from '@/stores/apiControlMedicamento';

type PeriodoMovimiento = 'todos' | 'dia' | 'rango' | 'mes' | 'anio';
type TipoMovimiento = 'todos' | 'ENTREGA' | 'CIERRE';

interface Movimiento {
    id: string;
    tipo: 'ENTREGA' | 'CIERRE';
    titulo: string;
    detalle: string;
    cantidad: string;
    fecha: string;
    estado: string;
}

interface FiltrosMovimientos {
    periodo: PeriodoMovimiento;
    tipo: TipoMovimiento;
    fecha: string;
    fechaInicio: string;
    fechaFin: string;
    mes: string;
    anio: string;
}

interface MovimientosMeta {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
    from: number | null;
    to: number | null;
}

const crearFiltrosIniciales = (): FiltrosMovimientos => ({
    periodo: 'todos',
    tipo: 'todos',
    fecha: '',
    fechaInicio: '',
    fechaFin: '',
    mes: '',
    anio: new Date().getFullYear().toString(),
});

const MedicamentosModule = () => {
    const [view, setView] = useState<ViewType>('entrega');
    const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [cierres, setCierres] = useState<any[]>([]);

    const [modalFiltrosAbierto, setModalFiltrosAbierto] = useState(false);
    const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
    const [errorMovimientos, setErrorMovimientos] = useState('');
    const [paginaMovimientos, setPaginaMovimientos] = useState(1);
    const [versionMovimientos, setVersionMovimientos] = useState(0);

    const [filtrosMovimientos, setFiltrosMovimientos] =
        useState<FiltrosMovimientos>(crearFiltrosIniciales);

    const [filtrosAplicados, setFiltrosAplicados] =
        useState<FiltrosMovimientos>(crearFiltrosIniciales);

    const [movimientosMeta, setMovimientosMeta] =
        useState<MovimientosMeta>({
            currentPage: 1,
            lastPage: 1,
            perPage: 5,
            total: 0,
            from: null,
            to: null,
        });

    const tabs: { key: ViewType; label: string }[] = [
        { key: 'entrega', label: 'Entrega' },
        { key: 'inventario', label: 'Reabastecer' },
        { key: 'medicamentos', label: 'Medicamentos' },
        { key: 'cierre', label: 'Corte/Cierre' },
    ];

    const cantidadFiltrosActivos =
        (filtrosAplicados.periodo !== 'todos' ? 1 : 0) +
        (filtrosAplicados.tipo !== 'todos' ? 1 : 0);

    const fetchActivos = useCallback(async () => {
        try {
            const data = await fetchMedicamentos();
            setMedicamentos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error cargando medicamentos:', error);
        }
    }, []);

    const fetchCierres = useCallback(async (params: any = {}) => {
        const tieneFiltros = Object.values(params).some(
            (value) =>
                value !== undefined &&
                value !== null &&
                value !== ''
        );

        if (!tieneFiltros) {
            setCierres([]);
            return [];
        }

        try {
            const data = await fetchCierresMedicamento(params);
            const lista = Array.isArray(data) ? data : [];

            setCierres(lista);

            return lista;
        } catch (error) {
            console.error('Error cargando cierres:', error);
            setCierres([]);

            return [];
        }
    }, []);

    const cargarMovimientos = useCallback(async () => {
        setCargandoMovimientos(true);
        setErrorMovimientos('');

        try {
            const data = await fetchMovimientos({
                periodo: filtrosAplicados.periodo,
                tipo: filtrosAplicados.tipo,
                fecha: filtrosAplicados.fecha,
                fecha_inicio: filtrosAplicados.fechaInicio,
                fecha_fin: filtrosAplicados.fechaFin,
                mes: filtrosAplicados.mes,
                anio: filtrosAplicados.anio,
                page: paginaMovimientos,
                per_page: 5,
            });

            setMovimientos(Array.isArray(data.data) ? data.data : []);

            setMovimientosMeta({
                currentPage: data.current_page ?? 1,
                lastPage: data.last_page ?? 1,
                perPage: data.per_page ?? 5,
                total: data.total ?? 0,
                from: data.from ?? null,
                to: data.to ?? null,
            });
        } catch (error) {
            console.error('Error cargando los movimientos:', error);

            setMovimientos([]);

            setErrorMovimientos(
                error instanceof Error
                    ? error.message
                    : 'No se pudieron cargar los movimientos.'
            );
        } finally {
            setCargandoMovimientos(false);
        }
    }, [
        filtrosAplicados,
        paginaMovimientos,
        versionMovimientos,
    ]);

    useEffect(() => {
        fetchActivos();
    }, [fetchActivos]);

    useEffect(() => {
        cargarMovimientos();
    }, [cargarMovimientos]);

    useEffect(() => {
        if (!modalFiltrosAbierto) {
            document.body.style.overflow = '';
            return;
        }

        document.body.style.overflow = 'hidden';

        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                cerrarModalFiltros();
            }
        };

        window.addEventListener('keydown', cerrarConEscape);

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', cerrarConEscape);
        };
    }, [modalFiltrosAbierto]);

    const actualizarFiltro = <
        K extends keyof FiltrosMovimientos,
    >(
        campo: K,
        valor: FiltrosMovimientos[K]
    ) => {
        setFiltrosMovimientos((estadoActual) => ({
            ...estadoActual,
            [campo]: valor,
        }));

        setErrorMovimientos('');
    };

    const cambiarPeriodo = (periodo: PeriodoMovimiento) => {
        setFiltrosMovimientos((estadoActual) => ({
            ...estadoActual,
            periodo,
            fecha: '',
            fechaInicio: '',
            fechaFin: '',
            mes: '',
        }));

        setErrorMovimientos('');
    };

    const abrirModalFiltros = () => {
        setFiltrosMovimientos({ ...filtrosAplicados });
        setErrorMovimientos('');
        setModalFiltrosAbierto(true);
    };

    const cerrarModalFiltros = () => {
        setFiltrosMovimientos({ ...filtrosAplicados });
        setErrorMovimientos('');
        setModalFiltrosAbierto(false);
    };

    const aplicarFiltrosMovimientos = () => {
        if (
            filtrosMovimientos.periodo === 'dia' &&
            !filtrosMovimientos.fecha
        ) {
            setErrorMovimientos(
                'Selecciona la fecha que deseas consultar.'
            );
            return;
        }

        if (
            filtrosMovimientos.periodo === 'rango' &&
            (!filtrosMovimientos.fechaInicio ||
                !filtrosMovimientos.fechaFin)
        ) {
            setErrorMovimientos(
                'Selecciona la fecha inicial y la fecha final.'
            );
            return;
        }

        if (
            filtrosMovimientos.periodo === 'rango' &&
            filtrosMovimientos.fechaInicio >
                filtrosMovimientos.fechaFin
        ) {
            setErrorMovimientos(
                'La fecha final no puede ser menor que la fecha inicial.'
            );
            return;
        }

        if (
            filtrosMovimientos.periodo === 'mes' &&
            !filtrosMovimientos.mes
        ) {
            setErrorMovimientos(
                'Selecciona el mes que deseas consultar.'
            );
            return;
        }

        if (
            filtrosMovimientos.periodo === 'anio' &&
            !filtrosMovimientos.anio
        ) {
            setErrorMovimientos(
                'Ingresa el año que deseas consultar.'
            );
            return;
        }

        setErrorMovimientos('');
        setPaginaMovimientos(1);
        setFiltrosAplicados({ ...filtrosMovimientos });
        setVersionMovimientos((version) => version + 1);
        setModalFiltrosAbierto(false);
    };

    const limpiarFiltrosMovimientos = () => {
        const filtrosIniciales = crearFiltrosIniciales();

        setErrorMovimientos('');
        setPaginaMovimientos(1);
        setFiltrosMovimientos(filtrosIniciales);
        setFiltrosAplicados(filtrosIniciales);
        setVersionMovimientos((version) => version + 1);
        setModalFiltrosAbierto(false);
    };

    const refrescarDatos = () => {
        fetchActivos();
        setCierres([]);
        setPaginaMovimientos(1);
        setVersionMovimientos((version) => version + 1);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 md:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-col justify-between gap-4 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
                    <div>
                        <h1 className="flex items-center gap-2 text-3xl font-black uppercase tracking-tighter">
                            <Pill
                                className="text-blue-600"
                                size={32}
                            />
                            Control Médico
                        </h1>

                        <p className="font-medium italic text-slate-500">
                            Gestión de insumos y medicamentos
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1.5">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setView(tab.key)}
                                className={`rounded-xl px-5 py-2.5 text-xs font-bold uppercase transition-all md:text-sm ${
                                    view === tab.key
                                        ? 'bg-white text-blue-600 shadow-md'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-1">
                        <ActionForms
                            view={view}
                            medicamentos={medicamentos}
                            onSuccess={refrescarDatos}
                        />

                        <div className="rounded-[2.5rem] bg-slate-900 p-6 text-white shadow-xl">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="flex items-center gap-2 font-black uppercase tracking-tighter text-slate-300">
                                        <History size={18} />
                                        Últimos Movimientos
                                    </h3>

                                    <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">
                                        {movimientosMeta.total}{' '}
                                        {movimientosMeta.total === 1
                                            ? 'registro'
                                            : 'registros'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={abrirModalFiltros}
                                    className={`relative flex h-10 items-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase transition ${
                                        cantidadFiltrosActivos > 0
                                            ? 'bg-blue-600 text-white hover:bg-blue-500'
                                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                                    }`}
                                >
                                    <SlidersHorizontal size={16} />
                                    Filtrar

                                    {cantidadFiltrosActivos > 0 && (
                                        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-orange-500 px-1 text-[9px] font-black text-white">
                                            {cantidadFiltrosActivos}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {cantidadFiltrosActivos > 0 && (
                                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2">
                                    <Filter
                                        size={14}
                                        className="text-blue-400"
                                    />

                                    <span className="text-[10px] font-black uppercase text-blue-300">
                                        Filtros activos
                                    </span>

                                    {filtrosAplicados.periodo !==
                                        'todos' && (
                                        <span className="rounded-lg bg-white/10 px-2 py-1 text-[9px] font-bold uppercase text-slate-300">
                                            {filtrosAplicados.periodo ===
                                            'dia'
                                                ? 'Día'
                                                : filtrosAplicados.periodo ===
                                                    'rango'
                                                  ? 'Rango'
                                                  : filtrosAplicados.periodo ===
                                                      'mes'
                                                    ? 'Mes'
                                                    : 'Año'}
                                        </span>
                                    )}

                                    {filtrosAplicados.tipo !==
                                        'todos' && (
                                        <span className="rounded-lg bg-white/10 px-2 py-1 text-[9px] font-bold uppercase text-slate-300">
                                            {filtrosAplicados.tipo ===
                                            'ENTREGA'
                                                ? 'Recibe'
                                                : 'Corte'}
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={
                                            limpiarFiltrosMovimientos
                                        }
                                        className="ml-auto text-[9px] font-black uppercase text-blue-300 transition hover:text-white"
                                    >
                                        Quitar
                                    </button>
                                </div>
                            )}

                            <div className="space-y-3">
                                {cargandoMovimientos && (
                                    <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold uppercase text-slate-500">
                                        <RotateCcw
                                            size={16}
                                            className="animate-spin"
                                        />
                                        Cargando movimientos...
                                    </div>
                                )}

                                {!cargandoMovimientos &&
                                    movimientos.length === 0 && (
                                        <div className="py-8 text-center text-xs font-bold uppercase text-slate-500">
                                            Sin movimientos encontrados
                                        </div>
                                    )}

                                {!cargandoMovimientos &&
                                    movimientos.map((movimiento) => (
                                        <div
                                            key={movimiento.id}
                                            className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-0"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div
                                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                                        movimiento.tipo ===
                                                        'CIERRE'
                                                            ? 'bg-orange-500/20 text-orange-400'
                                                            : movimiento.estado ===
                                                                'Activo'
                                                              ? 'bg-emerald-500/20 text-emerald-400'
                                                              : 'bg-blue-600/20 text-blue-400'
                                                    }`}
                                                >
                                                    {movimiento.tipo ===
                                                    'CIERRE' ? (
                                                        <Archive size={20} />
                                                    ) : movimiento.estado ===
                                                      'Activo' ? (
                                                        <PackagePlus
                                                            size={20}
                                                        />
                                                    ) : (
                                                        <UserPlus size={20} />
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-black uppercase tracking-tight">
                                                        {movimiento.tipo ===
                                                        'CIERRE'
                                                            ? movimiento.titulo
                                                            : `${movimiento.detalle} (${movimiento.titulo})`}
                                                    </p>

                                                    <p className="text-[10px] font-bold italic text-slate-400">
                                                        {movimiento.fecha} •{' '}
                                                        {movimiento.tipo ===
                                                        'CIERRE' ? (
                                                            <span className="text-orange-400">
                                                                Turno cerrado
                                                            </span>
                                                        ) : (
                                                            movimiento.estado
                                                        )}
                                                    </p>

                                                    {movimiento.tipo ===
                                                        'CIERRE' && (
                                                        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">
                                                            {
                                                                movimiento.detalle
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <span
                                                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-black ${
                                                    movimiento.tipo ===
                                                    'CIERRE'
                                                        ? 'bg-orange-500 text-white'
                                                        : 'bg-white/10'
                                                }`}
                                            >
                                                {movimiento.cantidad}
                                            </span>
                                        </div>
                                    ))}
                            </div>

                            {!cargandoMovimientos &&
                                movimientosMeta.total > 0 && (
                                    <div className="mt-5 border-t border-white/10 pt-4">
                                        <div className="mb-3 text-center text-[10px] font-bold uppercase text-slate-400">
                                            Mostrando{' '}
                                            {movimientosMeta.from} a{' '}
                                            {movimientosMeta.to} de{' '}
                                            {movimientosMeta.total}
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPaginaMovimientos(
                                                        (pagina) =>
                                                            Math.max(
                                                                1,
                                                                pagina - 1
                                                            )
                                                    )
                                                }
                                                disabled={
                                                    movimientosMeta.currentPage <=
                                                        1 ||
                                                    cargandoMovimientos
                                                }
                                                className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                                            >
                                                <ChevronLeft size={15} />
                                                Anterior
                                            </button>

                                            <span className="text-[10px] font-black uppercase text-slate-300">
                                                Página{' '}
                                                {
                                                    movimientosMeta.currentPage
                                                }{' '}
                                                de{' '}
                                                {
                                                    movimientosMeta.lastPage
                                                }
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPaginaMovimientos(
                                                        (pagina) =>
                                                            Math.min(
                                                                movimientosMeta.lastPage,
                                                                pagina + 1
                                                            )
                                                    )
                                                }
                                                disabled={
                                                    movimientosMeta.currentPage >=
                                                        movimientosMeta.lastPage ||
                                                    cargandoMovimientos
                                                }
                                                className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                                            >
                                                Siguiente
                                                <ChevronRight size={15} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>

                    <div className="space-y-6 lg:col-span-2">
                        <InventoryTable
                            medicamentos={medicamentos}
                            cierres={cierres}
                            onBuscarCierres={fetchCierres}
                        />
                    </div>
                </div>
            </div>

            {modalFiltrosAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            cerrarModalFiltros();
                        }
                    }}
                >
                    <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:px-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                    <SlidersHorizontal size={21} />
                                </div>

                                <div>
                                    <h2 className="text-lg font-black text-slate-900">
                                        Filtrar movimientos
                                    </h2>

                                    <p className="text-xs font-medium text-slate-500">
                                        Selecciona el período y el tipo
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarModalFiltros}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X size={21} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-5 md:p-6">
                            <div className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
                                        Tipo de período
                                    </label>

                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {[
                                            {
                                                value: 'todos',
                                                label: 'Todos',
                                            },
                                            {
                                                value: 'dia',
                                                label: 'Día',
                                            },
                                            {
                                                value: 'rango',
                                                label: 'Rango',
                                            },
                                            {
                                                value: 'mes',
                                                label: 'Mes',
                                            },
                                            {
                                                value: 'anio',
                                                label: 'Año',
                                            },
                                        ].map((opcion) => (
                                            <button
                                                key={opcion.value}
                                                type="button"
                                                onClick={() =>
                                                    cambiarPeriodo(
                                                        opcion.value as PeriodoMovimiento
                                                    )
                                                }
                                                className={`rounded-xl border px-3 py-3 text-xs font-black uppercase transition ${
                                                    filtrosMovimientos.periodo ===
                                                    opcion.value
                                                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                                                }`}
                                            >
                                                {opcion.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
                                        Tipo de movimiento
                                    </label>

                                    <select
                                        value={filtrosMovimientos.tipo}
                                        onChange={(event) =>
                                            actualizarFiltro(
                                                'tipo',
                                                event.target
                                                    .value as TipoMovimiento
                                            )
                                        }
                                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    >
                                        <option value="todos">
                                            Todos los movimientos
                                        </option>
                                        <option value="ENTREGA">
                                            Recibe medicamento
                                        </option>
                                        <option value="CIERRE">
                                            Corte de turno
                                        </option>
                                    </select>
                                </div>

                                {filtrosMovimientos.periodo ===
                                    'dia' && (
                                    <div>
                                        <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
                                            Fecha
                                        </label>

                                        <div className="relative">
                                            <CalendarDays
                                                size={18}
                                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                            />

                                            <input
                                                type="date"
                                                value={
                                                    filtrosMovimientos.fecha
                                                }
                                                onChange={(event) =>
                                                    actualizarFiltro(
                                                        'fecha',
                                                        event.target.value
                                                    )
                                                }
                                                className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>
                                    </div>
                                )}

                                {filtrosMovimientos.periodo ===
                                    'rango' && (
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
                                                Desde
                                            </label>

                                            <input
                                                type="date"
                                                value={
                                                    filtrosMovimientos.fechaInicio
                                                }
                                                onChange={(event) =>
                                                    actualizarFiltro(
                                                        'fechaInicio',
                                                        event.target.value
                                                    )
                                                }
                                                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
                                                Hasta
                                            </label>

                                            <input
                                                type="date"
                                                value={
                                                    filtrosMovimientos.fechaFin
                                                }
                                                onChange={(event) =>
                                                    actualizarFiltro(
                                                        'fechaFin',
                                                        event.target.value
                                                    )
                                                }
                                                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>
                                    </div>
                                )}

                                {filtrosMovimientos.periodo ===
                                    'mes' && (
                                    <div>
                                        <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
                                            Mes
                                        </label>

                                        <input
                                            type="month"
                                            value={
                                                filtrosMovimientos.mes
                                            }
                                            onChange={(event) =>
                                                actualizarFiltro(
                                                    'mes',
                                                    event.target.value
                                                )
                                            }
                                            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                )}

                                {filtrosMovimientos.periodo ===
                                    'anio' && (
                                    <div>
                                        <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
                                            Año
                                        </label>

                                        <input
                                            type="number"
                                            min="2000"
                                            max="2100"
                                            value={
                                                filtrosMovimientos.anio
                                            }
                                            onChange={(event) =>
                                                actualizarFiltro(
                                                    'anio',
                                                    event.target.value
                                                )
                                            }
                                            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                )}

                                {errorMovimientos && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                                        {errorMovimientos}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-3 md:px-6">
                            <button
                                type="button"
                                onClick={limpiarFiltrosMovimientos}
                                disabled={cargandoMovimientos}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black uppercase text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RotateCcw size={15} />
                                Limpiar
                            </button>

                            <button
                                type="button"
                                onClick={cerrarModalFiltros}
                                className="flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-black uppercase text-slate-600 transition hover:bg-slate-100"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={aplicarFiltrosMovimientos}
                                disabled={cargandoMovimientos}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black uppercase text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Search size={15} />
                                Aplicar filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MedicamentosModule;
