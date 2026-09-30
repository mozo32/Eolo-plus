import AppLayout from '@/layouts/app-layout';
import { FILTROS_CLIENTES_VACIOS, apiClientes, obtenerClientesApi, type Cliente, type FiltrosClientes } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Plus, X } from 'lucide-react';
import CabeceraPantalla from './components/CabeceraPantalla';
import { BOTON_PRIMARIO, FILTRO, TD, TH } from './components/estilos';
import ModalCliente from './components/ModalCliente';
import PiePaginacion from './components/PiePaginacion';
import { AccionesFila, FilasEstado, InsigniaEstado, SelectorEstado } from './components/PiezasCatalogo';
import { useAccionesCatalogo, type TextosCatalogo } from './components/useAccionesCatalogo';
import { useListaPaginada } from './components/useListaPaginada';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Clientes' }];

const textos: TextosCatalogo = {
    baja: 'Ya no se podrá elegir en prefacturas nuevas; lo registrado hasta hoy no cambia. Podrás reactivarlo desde el filtro "De baja".',
    reactivar: 'Volverá a poder elegirse en prefacturas nuevas.',
};

const SIN_DATO = <span className="text-[10px] font-black uppercase text-slate-300">—</span>;

/**
 * Clientes de facturación. Es el catálogo que crece sin techo, así que el
 * servidor busca (por nombre y por RFC), filtra por estado y pagina:
 * `useListaPaginada` pone la lista, con la espera de la búsqueda, el descarte
 * de respuestas viejas y la corrección de página; `useAccionesCatalogo` pone el
 * alta, la edición, la baja y la reactivación. El RFC repetido no es un error.
 */
export default function Clientes() {
    const lista = useListaPaginada<Cliente, FiltrosClientes>({ obtener: obtenerClientesApi, vacios: FILTROS_CLIENTES_VACIOS, mensajeError: 'No se pudieron cargar los clientes.' });
    const { registros, total, pagina, totalPaginas, porPagina, cargando, error, filtros, busqueda, setBusqueda, setFiltros, limpiarFiltros, hayFiltros, cambiarPagina, cambiarPorPagina, recargar } = lista;

    const { modal, setModal, accionandoId, guardar, darDeBaja, reactivar } = useAccionesCatalogo(apiClientes, { textos, alTerminar: recargar });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Clientes" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <CabeceraPantalla titulo="Clientes" descripcion="A quién se le factura">
                        <button type="button" onClick={() => setModal({ registro: null })} className={BOTON_PRIMARIO}>
                            <Plus size={14} />
                            NUEVO CLIENTE
                        </button>
                    </CabeceraPantalla>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {total} {total === 1 ? 'cliente' : 'clientes'}
                            </h3>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Buscar nombre o RFC..."
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    className={`${FILTRO} md:w-64`}
                                    aria-label="Buscar por nombre o RFC"
                                />
                                <SelectorEstado valor={filtros.estado} onChange={estado => setFiltros({ estado })} />

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
                                        <th className={`${TH} text-left`}>Nombre</th>
                                        <th className={TH}>RFC</th>
                                        <th className={TH}>Correo</th>
                                        <th className={TH}>Teléfono</th>
                                        <th className={TH}>Estado</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <FilasEstado
                                        columnas={6}
                                        cargando={cargando}
                                        error={error}
                                        vacio={registros.length === 0}
                                        textoVacio={hayFiltros ? 'No se encontraron clientes' : 'Aún no hay clientes'}
                                        onReintentar={() => void recargar()}
                                    />

                                    {!cargando &&
                                        !error &&
                                        registros.map(c => {
                                            const baja = c.status === 'N';
                                            const tono = baja ? 'text-slate-400' : 'text-slate-700';

                                            return (
                                                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                    <td className={`px-6 py-4 text-left text-[11px] font-bold uppercase ${tono}`}>{c.nombre}</td>
                                                    <td className={`${TD} text-[11px] font-bold ${tono}`}>{c.rfc ?? SIN_DATO}</td>
                                                    <td className={`${TD} text-[11px] font-bold ${tono}`}>{c.correo ?? SIN_DATO}</td>
                                                    <td className={`${TD} text-[11px] font-bold ${tono}`}>{c.telefono ?? SIN_DATO}</td>

                                                    <td className={TD}>
                                                        <InsigniaEstado baja={baja} />
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <AccionesFila
                                                            baja={baja}
                                                            ocupado={accionandoId !== null}
                                                            accionando={accionandoId === c.id}
                                                            onEditar={() => setModal({ registro: c })}
                                                            onBaja={() => void darDeBaja(c)}
                                                            onReactivar={() => void reactivar(c)}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <PiePaginacion pagina={pagina} totalPaginas={totalPaginas} total={total} porPagina={porPagina} onPagina={cambiarPagina} onPorPagina={cambiarPorPagina} />
                </div>
            </div>

            {modal && <ModalCliente cliente={modal.registro} onCerrar={() => setModal(null)} onGuardar={guardar} />}
        </AppLayout>
    );
}
