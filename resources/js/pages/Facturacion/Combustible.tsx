import AppLayout from '@/layouts/app-layout';
import {
    obtenerPrecioCombustibleVigenteApi,
    obtenerPreciosCombustibleApi,
    registrarPrecioCombustibleApi,
    type NuevoPrecioCombustible,
    type PrecioCombustible,
} from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import CabeceraPantalla from './components/CabeceraPantalla';
import { BOTON_PRIMARIO, TD, TH, toast } from './components/estilos';
import { fechaMexico, formatearMonto } from './components/formato';
import ModalPrecioCombustible from './components/ModalPrecioCombustible';
import PiePaginacion from './components/PiePaginacion';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Precio del combustible' }];

interface MetaPaginacion {
    pagina: number;
    totalPaginas: number;
    total: number;
}

/**
 * Precio del combustible con vigencias. ASA es el costo; Eolo, lo que se cobra.
 * Los precios no se editan ni se borran: registrar uno cierra la vigencia del
 * anterior y el histórico queda como evidencia.
 */
export default function Combustible() {
    const [vigente, setVigente] = useState<PrecioCombustible | null>(null);
    const [registros, setRegistros] = useState<PrecioCombustible[]>([]);
    const [meta, setMeta] = useState<MetaPaginacion>({ pagina: 1, totalPaginas: 1, total: 0 });
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(10);
    const [modalAbierto, setModalAbierto] = useState(false);

    const peticionRef = useRef(0);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        setCargando(true);

        try {
            const [precioVigente, historico] = await Promise.all([obtenerPrecioCombustibleVigenteApi(), obtenerPreciosCombustibleApi(pagina, porPagina)]);
            if (numero !== peticionRef.current) return;

            setVigente(precioVigente);
            setRegistros(historico.data);
            setMeta({ pagina: historico.current_page, totalPaginas: Math.max(historico.last_page, 1), total: historico.total });
            setError(null);
        } catch (e) {
            if (numero !== peticionRef.current) return;
            setRegistros([]);
            setError(e instanceof Error ? e.message : 'No se pudo cargar el precio del combustible.');
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [pagina, porPagina]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const registrar = async (datos: NuevoPrecioCombustible) => {
        const { precio } = await registrarPrecioCombustibleApi(datos);

        setModalAbierto(false);
        // El precio Eolo que se guardó es el del servidor, no el que se propuso en pantalla.
        toast.fire({ icon: 'success', title: `Precio registrado: ASA ${formatearMonto(precio.precio_asa, 4)} · Eolo ${formatearMonto(precio.precio_eolo, 4)}` });

        if (pagina === 1) await recargar();
        else setPagina(1);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Precio del combustible" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <CabeceraPantalla titulo="Precio del combustible" descripcion="ASA es el costo; Eolo es lo que se cobra">
                        <button type="button" onClick={() => setModalAbierto(true)} className={BOTON_PRIMARIO}>
                            <Plus size={14} />
                            REGISTRAR PRECIO
                        </button>
                    </CabeceraPantalla>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Precio ASA vigente (costo)</p>
                            <p className="mt-2 text-2xl font-black text-slate-800">{vigente ? formatearMonto(vigente.precio_asa, 4) : '—'}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Precio Eolo vigente (se cobra)</p>
                            <p className="mt-2 text-2xl font-black text-indigo-600">{vigente ? formatearMonto(vigente.precio_eolo, 4) : '—'}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vigente desde</p>
                            <p className="mt-2 text-2xl font-black text-slate-800">{vigente ? fechaMexico(vigente.vigencia_inicio) : '—'}</p>
                            {!cargando && !error && !vigente && <p className="mt-1 text-[10px] font-bold uppercase text-amber-600">Aún no se ha registrado ningún precio</p>}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Histórico de precios</h3>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className={TH}>Desde</th>
                                        <th className={TH}>Hasta</th>
                                        <th className={TH}>Precio ASA (costo)</th>
                                        <th className={TH}>Precio Eolo (se cobra)</th>
                                        <th className={TH}>Capturó</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {cargando && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Cargando…
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && error && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center">
                                                <p className="text-sm font-medium text-red-600">{error}</p>
                                                <button type="button" onClick={() => void recargar()} className="mt-3 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800">
                                                    Reintentar
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && !error && registros.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Todavía no hay precios registrados
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando &&
                                        !error &&
                                        registros.map(r => (
                                            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className={`${TD} text-[11px] font-bold text-slate-700`}>{fechaMexico(r.vigencia_inicio)}</td>
                                                <td className={TD}>
                                                    {r.vigencia_fin === null ? (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-600">Vigente</span>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-slate-700">{fechaMexico(r.vigencia_fin)}</span>
                                                    )}
                                                </td>
                                                <td className={`${TD} text-[11px] font-bold text-slate-700`}>{formatearMonto(r.precio_asa, 4)}</td>
                                                <td className={`${TD} text-[11px] font-black text-indigo-600`}>{formatearMonto(r.precio_eolo, 4)}</td>
                                                <td className={`${TD} text-[11px] font-bold uppercase text-slate-600`}>{r.capturado_por?.name ?? '—'}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <PiePaginacion
                        pagina={meta.pagina}
                        totalPaginas={meta.totalPaginas}
                        total={meta.total}
                        porPagina={porPagina}
                        onPagina={setPagina}
                        onPorPagina={cantidad => {
                            setPorPagina(cantidad);
                            setPagina(1);
                        }}
                    />
                </div>
            </div>

            {modalAbierto && <ModalPrecioCombustible vigente={vigente} onCerrar={() => setModalAbierto(false)} onGuardar={registrar} />}
        </AppLayout>
    );
}
