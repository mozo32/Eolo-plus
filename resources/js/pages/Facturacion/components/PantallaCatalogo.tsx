import AppLayout from '@/layouts/app-layout';
import { ErrorApi, type ApiCatalogo, type DatosCatalogo } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Ban, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import CabeceraPantalla from './CabeceraPantalla';
import { BADGE_ACTIVO, BADGE_BAJA, BOTON_PRIMARIO, FILTRO, TD, TH, toast } from './estilos';
import { formatearMonto } from './formato';
import ModalCatalogo, { type CampoCatalogo, type RegistroCatalogo } from './ModalCatalogo';

type FiltroEstado = 'activas' | 'baja' | 'todas';

/**
 * Minúsculas y sin marcas diacríticas. El `unique` del nombre corre en MySQL con
 * utf8mb4_unicode_ci, que ignora acentos y mayúsculas: "Helicoptero" choca con
 * "Helicóptero". La búsqueda debe encontrar lo mismo que rechaza el servidor.
 */
const normalizarBusqueda = (texto: string): string =>
    texto
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .trim()
        .toLowerCase();

interface Props<T extends RegistroCatalogo> {
    titulo: string;
    descripcion: string;
    breadcrumbs: BreadcrumbItem[];
    /** "NUEVA CATEGORÍA" */
    textoAlta: string;
    tituloAlta: string;
    tituloEdicion: string;
    campos: CampoCatalogo<T>[];
    api: ApiCatalogo<T>;
}

/**
 * Pantalla de catálogo con nombre e importes, alta/edición en modal y baja
 * lógica reversible. Es la misma para categorías de aeronave y tipos de motor.
 *
 * El servidor no filtra ni pagina estos catálogos (son cortos): se piden
 * completos, con las filas dadas de baja, y el filtro de estado y la búsqueda
 * se resuelven aquí. Las bajas importan porque el `unique` del nombre también
 * las cuenta: un nombre "libre" en pantalla puede dar 422 por una fila de baja.
 */
export default function PantallaCatalogo<T extends RegistroCatalogo>({ titulo, descripcion, breadcrumbs, textoAlta, tituloAlta, tituloEdicion, campos, api }: Props<T>) {
    const [registros, setRegistros] = useState<T[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [estado, setEstado] = useState<FiltroEstado>('activas');
    const [busqueda, setBusqueda] = useState('');

    const [modal, setModal] = useState<{ registro: T | null } | null>(null);
    const [accionandoId, setAccionandoId] = useState<number | null>(null);

    const peticionRef = useRef(0);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        setCargando(true);

        try {
            const lista = await api.listar();
            if (numero !== peticionRef.current) return;

            setRegistros(lista);
            setError(null);
        } catch (e) {
            if (numero !== peticionRef.current) return;
            setRegistros([]);
            setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.');
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [api]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const visibles = useMemo(() => {
        const texto = normalizarBusqueda(busqueda);

        return registros.filter(r => {
            if (estado === 'activas' && r.status !== 'A') return false;
            if (estado === 'baja' && r.status !== 'N') return false;

            return texto === '' || normalizarBusqueda(r.nombre).includes(texto);
        });
    }, [registros, estado, busqueda]);

    const guardar = async (datos: DatosCatalogo) => {
        const editando = modal?.registro ?? null;
        const respuesta = editando ? await api.actualizar(editando.id, datos) : await api.crear(datos);

        setModal(null);
        toast.fire({ icon: 'success', titleText: respuesta.message });
        await recargar();
    };

    /** 409: el estado ya era el pedido (otra persona lo cambió). Se avisa y se refresca la lista. */
    const ejecutarCambioDeEstado = async (registro: T, accion: () => Promise<string>, tituloError: string) => {
        if (accionandoId !== null) return;
        setAccionandoId(registro.id);

        try {
            toast.fire({ icon: 'success', titleText: await accion() });
        } catch (e) {
            await Swal.fire({
                icon: e instanceof ErrorApi && e.status === 409 ? 'info' : 'error',
                titleText: tituloError,
                text: e instanceof Error ? e.message : 'Error inesperado',
                confirmButtonColor: '#4f46e5',
            });
        } finally {
            setAccionandoId(null);
            await recargar();
        }
    };

    const darDeBaja = async (registro: T) => {
        const confirmacion = await Swal.fire({
            // El nombre lo captura un usuario: titleText (texto plano), nunca title, que SweetAlert2 interpreta como HTML.
            titleText: `Dar de baja "${registro.nombre}"`,
            text: 'Ya no aparecerá al asignar matrículas nuevas; las asignadas hasta hoy no cambian. Podrás reactivar el registro desde el filtro "De baja".',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, dar de baja',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            reverseButtons: true,
        });

        if (confirmacion.isConfirmed) await ejecutarCambioDeEstado(registro, () => api.desactivar(registro.id), 'No se pudo dar de baja');
    };

    const reactivar = async (registro: T) => {
        const confirmacion = await Swal.fire({
            titleText: `Reactivar "${registro.nombre}"`,
            text: 'Volverá a aparecer al asignar matrículas.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, reactivar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#059669',
            reverseButtons: true,
        });

        if (confirmacion.isConfirmed) await ejecutarCambioDeEstado(registro, () => api.reactivar(registro.id), 'No se pudo reactivar');
    };

    /** Desde el aviso de nombre repetido: muestra todas las filas filtradas por ese nombre. */
    const buscarNombre = (nombre: string) => {
        setEstado('todas');
        setBusqueda(nombre);
        setModal(null);
    };

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
                                <select value={estado} onChange={e => setEstado(e.target.value as FiltroEstado)} className={`${FILTRO} md:w-40`} aria-label="Filtrar por estado">
                                    <option value="activas">ACTIVAS</option>
                                    <option value="baja">DE BAJA</option>
                                    <option value="todas">TODAS</option>
                                </select>
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
                                    {cargando && (
                                        <tr>
                                            <td colSpan={columnas} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Cargando…
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && error && (
                                        <tr>
                                            <td colSpan={columnas} className="px-6 py-16 text-center">
                                                <p className="text-sm font-medium text-red-600">{error}</p>
                                                <button type="button" onClick={() => void recargar()} className="mt-3 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800">
                                                    Reintentar
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {!cargando && !error && visibles.length === 0 && (
                                        <tr>
                                            <td colSpan={columnas} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {registros.length === 0 ? 'Aún no hay registros' : 'No hay registros con este filtro'}
                                            </td>
                                        </tr>
                                    )}

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
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${baja ? BADGE_BAJA : BADGE_ACTIVO}`}>{baja ? 'De baja' : 'Activa'}</span>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setModal({ registro: r })}
                                                                title="Editar"
                                                                className="p-2 rounded transition-colors text-slate-400 hover:text-indigo-600"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>

                                                            {baja ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void reactivar(r)}
                                                                    disabled={accionandoId !== null}
                                                                    title="Reactivar"
                                                                    className="p-2 rounded transition-colors text-slate-400 hover:text-emerald-600 disabled:opacity-50"
                                                                >
                                                                    <RotateCcw size={16} className={accionandoId === r.id ? 'animate-spin' : ''} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void darDeBaja(r)}
                                                                    disabled={accionandoId !== null}
                                                                    title="Dar de baja"
                                                                    className="p-2 rounded transition-colors text-slate-400 hover:text-red-600 disabled:opacity-50"
                                                                >
                                                                    <Ban size={16} className={accionandoId === r.id ? 'animate-pulse' : ''} />
                                                                </button>
                                                            )}
                                                        </div>
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
                    onCerrar={() => setModal(null)}
                    onGuardar={guardar}
                    onBuscarNombre={buscarNombre}
                />
            )}
        </AppLayout>
    );
}
