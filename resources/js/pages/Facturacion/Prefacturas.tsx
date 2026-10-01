import AppLayout from '@/layouts/app-layout';
import { facturacionEditorPrefactura } from '@/routes';
import { FILTROS_PREFACTURA_VACIOS, obtenerPrefacturasApi, type FiltrosPrefactura, type Prefactura } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { X } from 'lucide-react';
import CabeceraPantalla from './components/CabeceraPantalla';
import { FILTRO, TD, TH } from './components/estilos';
import { fechaHoraSinZona, formatearMonto } from './components/formato';
import PiePaginacion from './components/PiePaginacion';
import { useListaPaginada } from './components/useListaPaginada';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Prefacturas' }];

const COLUMNAS = 7;

/** Lo que el sello dice de una cerrada: una discrepancia o una verificación que no se pudo hacer se ven, no se callan. */
function AvisoSelloFila({ prefactura }: { prefactura: Prefactura }) {
    if (prefactura.sello_discrepa === true) {
        return (
            <span className="mt-1 block rounded-full bg-red-100 px-3 py-1 text-[10px] font-black uppercase text-red-700" title="El total sellado no coincide con lo que suman los renglones. Ábrela para ver el detalle.">
                Total no cuadra
            </span>
        );
    }

    if (prefactura.sello_error) {
        return (
            <span className="mt-1 block rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-700" title={prefactura.sello_error}>
                Sin verificar
            </span>
        );
    }

    return null;
}

/**
 * Lista de prefacturas: borradores por omisión (es el trabajo pendiente) o cerradas. Cada fila lleva al editor.
 * El total que se muestra es el que calcula el servidor.
 */
export default function Prefacturas() {
    const lista = useListaPaginada<Prefactura, FiltrosPrefactura>({ obtener: obtenerPrefacturasApi, vacios: FILTROS_PREFACTURA_VACIOS, mensajeError: 'No se pudieron cargar las prefacturas.' });
    const { registros, total, pagina, totalPaginas, porPagina, cargando, error, filtros, busqueda, setBusqueda, setFiltros, limpiarFiltros, hayFiltros, cambiarPagina, cambiarPorPagina, recargar } = lista;

    const abrir = (prefactura: Prefactura) => router.visit(facturacionEditorPrefactura(prefactura.id).url);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Prefacturas" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <CabeceraPantalla titulo="Prefacturas" descripcion="Borradores por cerrar y prefacturas con folio" />

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {total} {total === 1 ? 'prefactura' : 'prefacturas'}
                            </h3>

                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    type="text"
                                    placeholder="Buscar matrícula, cliente o folio..."
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    className={`${FILTRO} lg:w-60`}
                                    aria-label="Buscar por matrícula, cliente o folio"
                                />

                                <select
                                    value={filtros.estado}
                                    onChange={e => setFiltros({ estado: e.target.value as FiltrosPrefactura['estado'] })}
                                    className={`${FILTRO} lg:w-36`}
                                    aria-label="Filtrar por estado"
                                >
                                    <option value="borrador">BORRADORES</option>
                                    <option value="cerrada">CERRADAS</option>
                                    <option value="">TODAS</option>
                                </select>

                                <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                                    Creada desde
                                    <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={e => setFiltros({ desde: e.target.value })} className={`${FILTRO} lg:w-36`} />
                                </label>

                                <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                                    hasta
                                    <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={e => setFiltros({ hasta: e.target.value })} className={`${FILTRO} lg:w-36`} />
                                </label>

                                {hayFiltros && (
                                    <button type="button" onClick={limpiarFiltros} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Limpiar filtros">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className={TH}>Folio</th>
                                        <th className={TH}>Matrícula</th>
                                        <th className={TH}>Cliente</th>
                                        <th className={TH}>Llegada</th>
                                        <th className={TH}>Destino</th>
                                        <th className={TH}>Total</th>
                                        <th className={TH}>Estado</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {cargando && (
                                        <tr>
                                            <td colSpan={COLUMNAS} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Cargando…
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && error && (
                                        <tr>
                                            <td colSpan={COLUMNAS} className="px-6 py-16 text-center">
                                                <p className="text-sm font-medium text-red-600">{error}</p>
                                                <button type="button" onClick={() => void recargar()} className="mt-3 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800">
                                                    Reintentar
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && !error && registros.length === 0 && (
                                        <tr>
                                            <td colSpan={COLUMNAS} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {hayFiltros ? 'No se encontraron prefacturas con esos filtros' : 'No hay prefacturas en borrador'}
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando &&
                                        !error &&
                                        registros.map(row => (
                                            <tr
                                                key={row.id}
                                                onClick={() => abrir(row)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') abrir(row);
                                                }}
                                                tabIndex={0}
                                                role="link"
                                                aria-label={`Abrir la prefactura de ${row.matricula ?? 'matrícula sin dato'}`}
                                                className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer focus:bg-slate-50 focus:outline-none"
                                            >
                                                <td className={`${TD} text-[11px] font-black ${row.folio === null ? 'text-slate-400' : 'text-slate-800'}`}>{row.folio === null ? 'Borrador' : row.folio}</td>
                                                <td className={`${TD} text-[11px] font-black text-slate-800`}>{row.matricula ?? '—'}</td>
                                                <td className={`${TD} text-[11px] font-bold uppercase text-slate-600`}>
                                                    {row.cliente ?? <span className="text-[10px] font-black uppercase text-amber-600">Sin cliente</span>}
                                                </td>
                                                <td className={`${TD} text-[11px] font-bold text-slate-600`}>{fechaHoraSinZona(row.llegada_at)}</td>
                                                <td className={`${TD} text-[11px] font-bold uppercase text-slate-600`}>
                                                    {row.destino ?? '—'}
                                                    {row.tipo_destino === 'internacional' && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black text-sky-700">INTERNACIONAL</span>}
                                                </td>
                                                <td className={`${TD} text-[11px] font-black text-slate-800`}>
                                                    {row.total === null ? (
                                                        <span className="text-red-600" title={row.totales_error ?? undefined}>
                                                            No se pudo calcular
                                                        </span>
                                                    ) : (
                                                        formatearMonto(row.total)
                                                    )}
                                                </td>
                                                <td className={TD}>
                                                    {row.estado === 'cerrada' ? (
                                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">Cerrada</span>
                                                    ) : (
                                                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-700">Borrador</span>
                                                    )}
                                                    <AvisoSelloFila prefactura={row} />
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
        </AppLayout>
    );
}
