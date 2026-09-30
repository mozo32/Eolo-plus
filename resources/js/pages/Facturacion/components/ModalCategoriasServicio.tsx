import { type CategoriaServicio, type DatosCatalogo } from '@/stores/apiFacturacionCatalogos';
import { Plus } from 'lucide-react';
import { BOTON_PRIMARIO, FILTRO, TD, TH } from './estilos';
import ModalBase from './ModalBase';
import ModalCatalogo from './ModalCatalogo';
import { AccionesFila, FilasEstado, InsigniaEstado, SelectorEstado } from './PiezasCatalogo';
import type { EstadoCatalogo } from './useCatalogo';

/** Largo máximo del nombre de una categoría de servicio, igual al de StoreCategoriaServicioRequest. */
const NOMBRE_CATEGORIA_MAX = 80;

interface Props {
    /** El catálogo de categorías ya cargado por la pantalla de servicios (la misma lista que llena sus filtros y el formulario). */
    categorias: EstadoCatalogo<CategoriaServicio, DatosCatalogo>;
    onCerrar: () => void;
}

/**
 * Administración de las categorías de servicio, dentro de la pantalla de servicios:
 * son una clasificación de los servicios y no tienen pantalla propia. Lista con
 * alta, edición, baja y reactivación; el alta y la edición abren el mismo modal
 * de nombre que usan los demás catálogos, encima de este.
 */
export default function ModalCategoriasServicio({ categorias, onCerrar }: Props) {
    const { registros, visibles, cargando, error, recargar, estado, setEstado, busqueda, setBusqueda, modal, setModal, accionandoId, guardar, darDeBaja, reactivar, buscarNombre } = categorias;

    return (
        <>
            <ModalBase idTitulo="titulo-modal-categorias-servicio" titulo="Categorías de servicio" subtitulo="Clasifican los servicios" tieneCambios={false} onCerrar={onCerrar} ancho="max-w-2xl">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex gap-2">
                            <input type="text" placeholder="Buscar nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className={`${FILTRO} md:w-48`} aria-label="Buscar categoría por nombre" />
                            <SelectorEstado valor={estado} onChange={setEstado} />
                        </div>

                        <button type="button" onClick={() => setModal({ registro: null })} className={BOTON_PRIMARIO}>
                            <Plus size={14} />
                            NUEVA CATEGORÍA
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[460px]">
                            <thead>
                                <tr className="bg-white border-b border-slate-100">
                                    <th className={`${TH} text-left`}>Nombre</th>
                                    <th className={TH}>Estado</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>

                            <tbody>
                                <FilasEstado
                                    columnas={3}
                                    cargando={cargando}
                                    error={error}
                                    vacio={visibles.length === 0}
                                    textoVacio={registros.length === 0 ? 'Aún no hay categorías' : 'No hay categorías con este filtro'}
                                    onReintentar={() => void recargar()}
                                />

                                {!cargando &&
                                    !error &&
                                    visibles.map(c => {
                                        const baja = c.status === 'N';

                                        return (
                                            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className={`px-6 py-4 text-left text-[11px] font-bold uppercase ${baja ? 'text-slate-400' : 'text-slate-700'}`}>{c.nombre}</td>

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
            </ModalBase>

            {modal && (
                <ModalCatalogo
                    titulo={modal.registro ? 'Editar categoría' : 'Nueva categoría'}
                    subtitulo={modal.registro ? modal.registro.nombre : 'Captura el nombre y guarda'}
                    registro={modal.registro}
                    campos={[]}
                    nombreMax={NOMBRE_CATEGORIA_MAX}
                    onCerrar={() => setModal(null)}
                    onGuardar={guardar}
                    onBuscarNombre={buscarNombre}
                />
            )}
        </>
    );
}
