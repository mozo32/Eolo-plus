import AppLayout from '@/layouts/app-layout';
import { type ApiCatalogo } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import CabeceraPantalla from './CabeceraPantalla';
import { BOTON_PRIMARIO, FILTRO, TD, TH } from './estilos';
import { formatearMonto } from './formato';
import ModalCatalogo, { NOMBRE_MAX, type CampoCatalogo, type RegistroCatalogo } from './ModalCatalogo';
import { AccionesFila, FilasEstado, InsigniaEstado, SelectorEstado } from './PiezasCatalogo';
import { type TextosCatalogo } from './useAccionesCatalogo';
import { useCatalogo } from './useCatalogo';

/** Lo que dicen los avisos de baja y reactivación de los catálogos que se asignan a matrículas. */
const TEXTOS_MATRICULA: TextosCatalogo = {
    baja: 'Ya no aparecerá al asignar matrículas nuevas; las asignadas hasta hoy no cambian. Podrás reactivar el registro desde el filtro "De baja".',
    reactivar: 'Volverá a aparecer al asignar matrículas.',
};

interface Props<T extends RegistroCatalogo> {
    titulo: string;
    descripcion: string;
    breadcrumbs: BreadcrumbItem[];
    /** "NUEVA CATEGORÍA" */
    textoAlta: string;
    tituloAlta: string;
    tituloEdicion: string;
    /** Los importes además del nombre; vacío en los catálogos de nombre suelto. */
    campos: CampoCatalogo<T>[];
    api: ApiCatalogo<T>;
    /** Largo máximo del nombre, igual al del servidor. Por omisión, 60. */
    nombreMax?: number;
    /** Qué pasa al dar de baja y al reactivar. Por omisión, lo de los catálogos de matrícula. */
    textos?: TextosCatalogo;
}

/**
 * Pantalla de catálogo con nombre e importes (puede no tener importes), alta y
 * edición en modal y baja lógica reversible. Es la misma para categorías de
 * aeronave, tipos de motor, formas de pago y proveedores; la lógica de carga,
 * filtro, baja y reactivación está en `useCatalogo`.
 */
export default function PantallaCatalogo<T extends RegistroCatalogo>({ titulo, descripcion, breadcrumbs, textoAlta, tituloAlta, tituloEdicion, campos, api, nombreMax = NOMBRE_MAX, textos = TEXTOS_MATRICULA }: Props<T>) {
    const { registros, visibles, cargando, error, recargar, estado, setEstado, busqueda, setBusqueda, modal, setModal, accionandoId, guardar, darDeBaja, reactivar, buscarNombre } = useCatalogo(api, { textos });

    const columnas = campos.length + 3;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={titulo} />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <CabeceraPantalla titulo={titulo} descripcion={descripcion}>
                        <button type="button" onClick={() => setModal({ registro: null })} className={BOTON_PRIMARIO}>
                            <Plus size={14} />
                            {textoAlta}
                        </button>
                    </CabeceraPantalla>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {visibles.length} {visibles.length === 1 ? 'registro' : 'registros'}
                            </h3>

                            <div className="flex gap-2">
                                <input type="text" placeholder="Buscar nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className={`${FILTRO} md:w-56`} aria-label="Buscar por nombre" />
                                <SelectorEstado valor={estado} onChange={setEstado} />
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className={`${TH} text-left`}>Nombre</th>
                                        {campos.map(c => (
                                            <th key={c.clave} className={TH}>
                                                {c.etiqueta}
                                            </th>
                                        ))}
                                        <th className={TH}>Estado</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <FilasEstado
                                        columnas={columnas}
                                        cargando={cargando}
                                        error={error}
                                        vacio={visibles.length === 0}
                                        textoVacio={registros.length === 0 ? 'Aún no hay registros' : 'No hay registros con este filtro'}
                                        onReintentar={() => void recargar()}
                                    />

                                    {!cargando &&
                                        !error &&
                                        visibles.map(r => {
                                            const baja = r.status === 'N';

                                            return (
                                                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                    <td className={`px-6 py-4 text-left text-[11px] font-bold uppercase ${baja ? 'text-slate-400' : 'text-slate-700'}`}>{r.nombre}</td>

                                                    {campos.map(c => (
                                                        <td key={c.clave} className={`${TD} text-[11px] font-bold ${baja ? 'text-slate-400' : 'text-slate-700'}`}>
                                                            {formatearMonto(c.leer(r))}
                                                        </td>
                                                    ))}

                                                    <td className={TD}>
                                                        <InsigniaEstado baja={baja} />
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <AccionesFila
                                                            baja={baja}
                                                            ocupado={accionandoId !== null}
                                                            accionando={accionandoId === r.id}
                                                            onEditar={() => setModal({ registro: r })}
                                                            onBaja={() => void darDeBaja(r)}
                                                            onReactivar={() => void reactivar(r)}
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

            {modal && (
                <ModalCatalogo
                    titulo={modal.registro ? tituloEdicion : tituloAlta}
                    subtitulo={modal.registro ? modal.registro.nombre : 'Captura los datos y guarda'}
                    registro={modal.registro}
                    campos={campos}
                    nombreMax={nombreMax}
                    onCerrar={() => setModal(null)}
                    onGuardar={guardar}
                    onBuscarNombre={buscarNombre}
                />
            )}
        </AppLayout>
    );
}
