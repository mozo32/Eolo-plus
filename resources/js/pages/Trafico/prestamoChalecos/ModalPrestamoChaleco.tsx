import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import PrestamoChalecoForm from './PrestamoChalecoForm';
import type { PrestamoChalecoForm as Formulario } from './types';

interface Props {
    onCerrar: () => void;
    /** Formulario válido: el padre guarda y cierra el modal si el servidor lo aceptó. */
    onGuardado: (datos: Formulario) => Promise<boolean>;
}

/**
 * Modal que envuelve el formulario aprobado sin cambiar su interior. Escape y
 * el clic fuera cierran directo si no hay nada capturado; si lo hay, piden
 * confirmación. Al cerrar se desmonta el formulario y FotoIne revoca su URL.
 */
export default function ModalPrestamoChaleco({ onCerrar, onGuardado }: Props) {
    const [tieneDatos, setTieneDatos] = useState(false);
    const tieneDatosRef = useRef(false);

    useEffect(() => {
        tieneDatosRef.current = tieneDatos;
    }, [tieneDatos]);

    const intentarCerrar = useCallback(async () => {
        if (!tieneDatosRef.current) {
            onCerrar();
            return;
        }

        // Si ya hay otra alerta abierta (por ejemplo, la de limpiar), no se encima.
        if (Swal.isVisible()) return;

        const confirmacion = await Swal.fire({
            title: 'Cerrar sin guardar',
            text: 'Se perderá la información capturada, incluida la fotografía.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Seguir capturando',
            confirmButtonColor: '#dc2626',
            reverseButtons: true,
        });

        if (confirmacion.isConfirmed) onCerrar();
    }, [onCerrar]);

    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !Swal.isVisible()) void intentarCerrar();
        };

        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [intentarCerrar]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-prestamo-chaleco"
        >
            <div className="absolute inset-0" onClick={() => void intentarCerrar()} />

            <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[92vh] flex flex-col">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 id="titulo-prestamo-chaleco" className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                            Registrar préstamo de chaleco
                        </h3>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Formulario de préstamo de chaleco</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void intentarCerrar()}
                        className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <PrestamoChalecoForm onGuardado={onGuardado} onCambioCaptura={setTieneDatos} />
                </div>
            </div>
        </div>
    );
}
