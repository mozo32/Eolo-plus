import AppLayout from '@/layouts/app-layout';
import { apiCategoriasServicio, apiServicios, type Servicio } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Plus, Tags, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import CabeceraPantalla from './components/CabeceraPantalla';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, FILTRO, TD, TH } from './components/estilos';
import { AJUSTES_PRECIO, formatearMonto } from './components/formato';
import ModalCategoriasServicio from './components/ModalCategoriasServicio';
import ModalServicio from './components/ModalServicio';
import { AccionesFila, FilasEstado, InsigniaEstado, SelectorEstado } from './components/PiezasCatalogo';
import { type TextosCatalogo } from './components/useAccionesCatalogo';
import { useCatalogo } from './components/useCatalogo';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Servicios' }];

const textosServicio: TextosCatalogo = {
    baja: 'Ya no se podrá elegir en prefacturas nuevas; lo registrado hasta hoy no cambia. Podrás reactivarlo desde el filtro "De baja".',
    reactivar: 'Volverá a poder elegirse en prefacturas nuevas.',
};

const textosCategoria: TextosCatalogo = {
    baja: 'Ya no se podrá asignar a otros servicios; los que la tienen hoy la conservan. Podrás reactivarla desde el filtro "De baja".',
    reactivar: 'Volverá a poder asignarse a los servicios.',
};

/** Filtro de categoría: todas, solo los sin categoría, o el id de una. */
const SIN_CATEGORIA = 'sin';

type FiltroTercero = '' | 'si' | 'no';

const TITULO_AJUSTE = Object.fromEntries(AJUSTES_PRECIO.map(a => [a.valor, a.titulo]));

/**
 * Servicios de facturación, con filtro por categoría y por "de tercero". Las
 * categorías de servicio se administran desde un modal de esta misma pantalla.
 *
 * El listado llega completo del servidor; la carga, el filtro de estado y de
 * búsqueda, la baja y la reactivación son los de `useCatalogo`, igual que para
 * las categorías. Al cambiar una categoría se recargan también los servicios,
 * que traen su categoría.
 */
export default function Servicios() {
    const servicios = useCatalogo(apiServicios, { textos: textosServicio });
    const categorias = useCatalogo(apiCategoriasServicio, { textos: textosCategoria, alCambiar: servicios.recargar });

    const { registros, visibles, cargando, error, recargar, estado, setEstado, busqueda, setBusqueda, modal, setModal, accionandoId, guardar, darDeBaja, reactivar } = servicios;

    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroTercero, setFiltroTercero] = useState<FiltroTercero>('');
    const [verCategorias, setVerCategorias] = useState(false);

    const filtrados = useMemo(
        () =>
            visibles.filter(s => {
                if (filtroCategoria === SIN_CATEGORIA && s.categoria_servicio_id !== null) return false;
                if (filtroCategoria !== '' && filtroCategoria !== SIN_CATEGORIA && String(s.categoria_servicio_id) !== filtroCategoria) return false;
                if (filtroTercero === 'si' && !s.es_de_tercero) return false;
                if (filtroTercero === 'no' && s.es_de_tercero) return false;

                return true;
            }),
        [visibles, filtroCategoria, filtroTercero],
    );

    const hayFiltrosExtra = filtroCategoria !== '' || filtroTercero !== '';

    const limpiarFiltros = () => {
        setBusqueda('');
        setFiltroCategoria('');
        setFiltroTercero('');
        setEstado('activas');
    };

    const abrirModal = (servicio: Servicio | null) => {
        // Si las categorías fallaron al cargar, se reintenta al abrir; el modal avisa mientras tanto.
        if (categorias.error !== null) void categorias.recargar();
        setModal({ registro: servicio });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Servicios" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <CabeceraPantalla titulo="Servicios" descripcion="Lo que se factura: precio, margen y ajuste">
                        <button type="button" onClick={() => setVerCategorias(true)} className={`${BOTON_SECUNDARIO} flex items-center gap-2`}>
                            <Tags size={14} />
                            CATEGORÍAS
                        </button>
                        <button type="button" onClick={() => abrirModal(null)} className={BOTON_PRIMARIO}>
                            <Plus size={14} />
                            NUEVO SERVICIO
                        </button>
                    </CabeceraPantalla>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {filtrados.length} {filtrados.length === 1 ? 'servicio' : 'servicios'}
                            </h3>

                            <div className="flex flex-wrap gap-2 items-center">
                                <input type="text" placeholder="Buscar nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className={`${FILTRO} lg:w-48`} aria-label="Buscar por nombre" />

                                <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className={`${FILTRO} lg:w-48`} aria-label="Filtrar por categoría">
                                    <option value="">TODAS LAS CATEGORÍAS</option>
                                    <option value={SIN_CATEGORIA}>SIN CATEGORÍA</option>
                                    {categorias.registros.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}
                                            {c.status === 'N' ? ' (de baja)' : ''}
                                        </option>
                                    ))}
                                </select>

                                <select value={filtroTercero} onChange={e => setFiltroTercero(e.target.value as FiltroTercero)} className={`${FILTRO} lg:w-40`} aria-label="Filtrar por de tercero">
                                    <option value="">DE TERCERO: TODOS</option>
                                    <option value="si">SOLO DE TERCERO</option>
                                    <option value="no">SOLO PROPIOS</option>
                                </select>

                                <SelectorEstado valor={estado} onChange={setEstado} />

                                {(hayFiltrosExtra || busqueda !== '' || estado !== 'activas') && (
                                    <button type="button" onClick={limpiarFiltros} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Limpiar filtros">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className={`${TH} text-left`}>Nombre</th>
                                        <th className={TH}>Categoría</th>
                                        <th className={TH}>Precio</th>
                                        <th className={TH}>De tercero</th>
                                        <th className={TH}>Margen</th>
                                        <th className={TH}>Ajuste</th>
                                        <th className={TH}>Estado</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <FilasEstado
                                        columnas={8}
                                        cargando={cargando}
                                        error={error}
                                        vacio={filtrados.length === 0}
                                        textoVacio={registros.length === 0 ? 'Aún no hay servicios' : 'No se encontraron servicios'}
                                        onReintentar={() => void recargar()}
                                    />

                                    {!cargando &&
                                        !error &&
                                        filtrados.map(s => {
                                            const baja = s.status === 'N';
                                            const tono = baja ? 'text-slate-400' : 'text-slate-700';

                                            return (
                                                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                    <td className={`px-6 py-4 text-left text-[11px] font-bold uppercase ${tono}`}>{s.nombre}</td>

                                                    <td className={TD}>
                                                        {s.categoria ? (
                                                            <span className={`text-[11px] font-bold uppercase ${s.categoria.status === 'N' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                                {s.categoria.nombre}
                                                                {s.categoria.status === 'N' && ' (de baja)'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase text-slate-300">Sin categoría</span>
                                                        )}
                                                    </td>

                                                    <td className={`${TD} text-[11px] font-bold ${tono}`}>{formatearMonto(s.precio_unitario, 4)}</td>

                                                    <td className={`${TD} text-[10px] font-black uppercase ${s.es_de_tercero ? 'text-indigo-600' : 'text-slate-400'}`}>{s.es_de_tercero ? 'Sí' : 'No'}</td>

                                                    <td className={`${TD} text-[11px] font-bold ${tono}`}>{Number(s.margen)} %</td>

                                                    <td className={`${TD} text-[10px] font-black uppercase ${s.ajuste_precio === 'ninguno' ? 'text-slate-400' : 'text-amber-600'}`}>{TITULO_AJUSTE[s.ajuste_precio] ?? s.ajuste_precio}</td>

                                                    <td className={TD}>
                                                        <InsigniaEstado baja={baja} />
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <AccionesFila
                                                            baja={baja}
                                                            ocupado={accionandoId !== null}
                                                            accionando={accionandoId === s.id}
                                                            onEditar={() => abrirModal(s)}
                                                            onBaja={() => void darDeBaja(s)}
                                                            onReactivar={() => void reactivar(s)}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {modal && <ModalServicio servicio={modal.registro} categorias={{ lista: categorias.registros, cargando: categorias.cargando, error: categorias.error }} onCerrar={() => setModal(null)} onGuardar={guardar} />}

            {verCategorias && <ModalCategoriasServicio categorias={categorias} onCerrar={() => setVerCategorias(false)} />}
        </AppLayout>
    );
}
