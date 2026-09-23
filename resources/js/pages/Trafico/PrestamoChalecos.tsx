import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Filter, Plus } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import ModalPrestamoChaleco from './prestamoChalecos/ModalPrestamoChaleco';
import TablaPrestamosChalecos from './prestamoChalecos/TablaPrestamosChalecos';
import type { PrestamoChalecoForm } from './prestamoChalecos/types';
import { usePrestamosChalecos } from './prestamoChalecos/usePrestamosChalecos';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Préstamo de chalecos' }];

/**
 * Préstamo de chalecos al personal visitante.
 *
 * Estructura visual tomada de ServicioComisariato.tsx (tabla estándar de
 * Tráfico). La fotografía de la INE se guarda en disco privado y solo se ve a
 * través del endpoint protegido.
 */
export default function PrestamoChalecos() {
    const prestamos = usePrestamosChalecos();
    const [modalAbierto, setModalAbierto] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);

    /** Devuelve true si se guardó: el modal se cierra solo en ese caso. */
    const guardar = async (datos: PrestamoChalecoForm): Promise<boolean> => {
        if (datos.usuario_entrega_id === null || !datos.foto_ine) return false;

        try {
            await prestamos.agregar({
                fecha: datos.fecha,
                nombre_recibe: datos.nombre_recibe.trim(),
                usuario_entrega_id: datos.usuario_entrega_id,
                foto_ine: datos.foto_ine,
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar el préstamo',
                text: error instanceof Error ? error.message : 'Error inesperado',
            });

            return false;
        }

        setModalAbierto(false);

        Swal.fire({
            icon: 'success',
            title: 'Préstamo registrado',
            text: 'El préstamo de chaleco se registró correctamente.',
            confirmButtonColor: '#00677F',
            timer: 2500,
            showConfirmButton: false,
        });

        return true;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Préstamo de chalecos" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Préstamo de chalecos</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Registro de entrega de chalecos al personal visitante</p>
                        </div>

                        <div className="flex gap-2 items-center">
                            <button
                                type="button"
                                onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${
                                    filtersOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <Filter size={14} />
                                <span>{filtersOpen ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setModalAbierto(true)}
                                className="text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 flex items-center gap-2"
                            >
                                <Plus size={14} />
                                NUEVO PRÉSTAMO
                            </button>
                        </div>
                    </div>

                    <TablaPrestamosChalecos prestamos={prestamos} filtersOpen={filtersOpen} />
                </div>
            </div>

            {modalAbierto && <ModalPrestamoChaleco onCerrar={() => setModalAbierto(false)} onGuardado={guardar} />}
        </AppLayout>
    );
}
