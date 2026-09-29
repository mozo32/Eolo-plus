import AppLayout from '@/layouts/app-layout';
import { actualizarAeronaveFacturableApi, apiCategoriasAeronave, apiTiposMotor, type AeronaveFacturable, type CambiosAeronave, type CategoriaAeronave, type TipoMotor } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import CabeceraPantalla from './components/CabeceraPantalla';
import { FILTRO, TD, TH, toast } from './components/estilos';
import { formatearMonto } from './components/formato';
import ModalAeronave, { type CatalogosAeronave } from './components/ModalAeronave';
import PiePaginacion from './components/PiePaginacion';
import { useAeronavesFacturables } from './components/useAeronavesFacturables';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Aeronaves de facturación' }];

const BADGE_ESTATUS = { transito: 'bg-amber-100 text-amber-700', guarda: 'bg-sky-100 text-sky-700' } as const;
const ETIQUETA_ESTATUS = { transito: 'Tránsito', guarda: 'Guarda' } as const;

/** Lo que se cobrará por una tarifa: la propia de la matrícula, la heredada o, si no hay de dónde, "sin tarifa". */
function CeldaTarifa({ propia, efectiva }: { propia: string | null; efectiva: string | null }) {
    if (efectiva === null) {
        return <span className="text-[10px] font-black uppercase text-red-500">Sin tarifa</span>;
    }

    return (
        <div className="flex flex-col items-center">
            <span className="text-[11px] font-bold text-slate-700">{formatearMonto(efectiva)}</span>
            <span className={`text-[9px] font-black uppercase tracking-wider ${propia !== null ? 'text-indigo-500' : 'text-slate-400'}`}>{propia !== null ? 'Propia' : 'Hereda'}</span>
        </div>
    );
}

/**
 * Datos de cobro de cada matrícula: categoría, motor, estatus, derecho de
 * vuelos y tarifas propias. Las matrículas se crean solas al darse de alta la
 * aeronave; aquí solo se clasifican y se ajustan.
 */
export default function AeronavesFacturacion() {
    const aeronaves = useAeronavesFacturables();
    const { registros, total, pagina, totalPaginas, porPagina, cargando, error, filtros, busqueda, setBusqueda, setFiltros, limpiarFiltros, hayFiltros, cambiarPagina, cambiarPorPagina, recargar } = aeronaves;

    const [catalogos, setCatalogos] = useState<{ categorias: CategoriaAeronave[]; motores: TipoMotor[] }>({ categorias: [], motores: [] });
    const [catalogosCargando, setCatalogosCargando] = useState(true);
    const [catalogosError, setCatalogosError] = useState<string | null>(null);

    const [editando, setEditando] = useState<AeronaveFacturable | null>(null);

    const cargarCatalogos = useCallback(async () => {
        setCatalogosCargando(true);

        try {
            // Todas, también las de baja: una matrícula puede seguir asignada a una que se dio de baja.
            const [categorias, motores] = await Promise.all([apiCategoriasAeronave.listar(), apiTiposMotor.listar()]);
            setCatalogos({ categorias, motores });
            setCatalogosError(null);
        } catch (e) {
            setCatalogosError(e instanceof Error ? e.message : 'Error inesperado');
        } finally {
            setCatalogosCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarCatalogos();
    }, [cargarCatalogos]);

    const abrirEdicion = (aeronave: AeronaveFacturable) => {
        // Si los catálogos fallaron al cargar, se reintenta al abrir; el modal avisa mientras tanto.
        if (catalogosError !== null) void cargarCatalogos();
        setEditando(aeronave);
    };

    const guardar = async (cambios: CambiosAeronave) => {
        if (!editando) return;

        const { message } = await actualizarAeronaveFacturableApi(editando.id, cambios);

        setEditando(null);
        toast.fire({ icon: 'success', title: message });
        // Se recarga en vez de parchar la fila: con "Sin clasificar" activo, la matrícula recién clasificada debe salir de la lista.
        await recargar();
    };

    const catalogosModal: CatalogosAeronave = { ...catalogos, cargando: catalogosCargando, error: catalogosError };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Aeronaves de facturación" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <CabeceraPantalla titulo="Aeronaves de facturación" descripcion="Categoría, motor, estatus y tarifas propias de cada matrícula" />

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Matrículas</h3>

                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    type="text"
                                    placeholder="Buscar matrícula..."
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value.toUpperCase())}
                                    className={`${FILTRO} lg:w-48`}
                                    aria-label="Buscar por matrícula"
                                />

                                <select
                                    value={filtros.estatus}
                                    onChange={e => setFiltros({ estatus: e.target.value as '' | 'transito' | 'guarda' })}
                                    className={`${FILTRO} lg:w-40`}
                                    aria-label="Filtrar por estatus"
                                >
                                    <option value="">TODOS LOS ESTATUS</option>
                                    <option value="transito">TRÁNSITO</option>
                                    <option value="guarda">GUARDA</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => setFiltros({ sin_categoria: !filtros.sin_categoria })}
                                    aria-pressed={filtros.sin_categoria}
                                    title="Matrículas sin categoría: todavía no se pueden facturar"
                                    className={`text-[10px] font-black px-4 py-2 rounded border transition-all ${
                                        filtros.sin_categoria ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    SIN CLASIFICAR
                                </button>

                                {hayFiltros && (
                                    <button type="button" onClick={limpiarFiltros} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Limpiar filtros">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1200px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className={TH}>Matrícula</th>
                                        <th className={TH}>Categoría</th>
                                        <th className={TH}>Motor</th>
                                        <th className={TH}>Estatus</th>
                                        <th className={TH}>Derecho de vuelos</th>
                                        <th className={TH}>Pernocta</th>
                                        <th className={TH}>Tránsito 2 h</th>
                                        <th className={TH}>Tránsito 12 h</th>
                                        <th className={TH}>Aterrizaje</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {cargando && (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Cargando…
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && error && (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-16 text-center">
                                                <p className="text-sm font-medium text-red-600">{error}</p>
                                                <button type="button" onClick={() => void recargar()} className="mt-3 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800">
                                                    Reintentar
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && !error && registros.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {filtros.sin_categoria && !busqueda && !filtros.estatus ? 'Todas las matrículas están clasificadas' : 'No se encontraron matrículas'}
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando &&
                                        !error &&
                                        registros.map(row => (
                                            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className={`${TD} text-[11px] font-black text-slate-800`}>{row.matricula ?? '—'}</td>

                                                <td className={TD}>
                                                    {row.categoria ? (
                                                        <span className={`text-[11px] font-bold uppercase ${row.categoria.status === 'N' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                            {row.categoria.nombre}
                                                            {row.categoria.status === 'N' && ' (de baja)'}
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700">Sin clasificar</span>
                                                    )}
                                                </td>

                                                <td className={TD}>
                                                    {row.tipo_motor ? (
                                                        <span className={`text-[11px] font-bold uppercase ${row.tipo_motor.status === 'N' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                            {row.tipo_motor.nombre}
                                                            {row.tipo_motor.status === 'N' && ' (de baja)'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase text-slate-300">Sin motor</span>
                                                    )}
                                                </td>

                                                <td className={TD}>
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${BADGE_ESTATUS[row.estatus]}`}>{ETIQUETA_ESTATUS[row.estatus]}</span>
                                                </td>

                                                <td className={`${TD} text-[10px] font-black uppercase ${row.cobra_derecho_vuelos ? 'text-emerald-600' : 'text-slate-400'}`}>{row.cobra_derecho_vuelos ? 'Sí cobra' : 'No cobra'}</td>

                                                <td className={TD}>
                                                    <CeldaTarifa propia={row.tarifa_pernocta} efectiva={row.tarifa_pernocta_efectiva} />
                                                </td>
                                                <td className={TD}>
                                                    <CeldaTarifa propia={row.tarifa_transito_2h} efectiva={row.tarifa_transito_2h_efectiva} />
                                                </td>
                                                <td className={TD}>
                                                    <CeldaTarifa propia={row.tarifa_transito_12h} efectiva={row.tarifa_transito_12h_efectiva} />
                                                </td>
                                                <td className={TD}>
                                                    <CeldaTarifa propia={row.tarifa_aterrizaje} efectiva={row.tarifa_aterrizaje_efectiva} />
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button type="button" onClick={() => abrirEdicion(row)} title="Editar" className="p-2 rounded transition-colors text-slate-400 hover:text-indigo-600">
                                                            <Pencil size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <PiePaginacion pagina={pagina} totalPaginas={totalPaginas} total={total} porPagina={porPagina} onPagina={cambiarPagina} onPorPagina={cambiarPorPagina} />
                </div>
            </div>

            {editando && <ModalAeronave aeronave={editando} catalogos={catalogosModal} onCerrar={() => setEditando(null)} onGuardar={guardar} />}
        </AppLayout>
    );
}
