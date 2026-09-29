import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import Swal from 'sweetalert2';

interface Props {
    idTitulo: string;
    titulo: string;
    subtitulo: string;
    /** Con cambios sin guardar, Escape y el clic fuera piden confirmación. */
    tieneCambios: boolean;
    onCerrar: () => void;
    /** Clase de ancho máximo de Tailwind. */
    ancho?: string;
    children: ReactNode;
}

/** Carcasa de los modales de Facturación; mismo aspecto que el de Préstamo de chalecos. */
export default function ModalBase({ idTitulo, titulo, subtitulo, tieneCambios, onCerrar, ancho = 'max-w-2xl', children }: Props) {
    const tieneCambiosRef = useRef(tieneCambios);

    useEffect(() => {
        tieneCambiosRef.current = tieneCambios;
    }, [tieneCambios]);

    const intentarCerrar = useCallback(async () => {
        if (!tieneCambiosRef.current) {
            onCerrar();
            return;
        }

        // Si ya hay otra alerta abierta no se encima.
        if (Swal.isVisible()) return;

        const confirmacion = await Swal.fire({
            title: 'Cerrar sin guardar',
            text: 'Se perderá la información capturada.',
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
            <div className="absolute inset-0" onClick={() => void intentarCerrar()} />

            <div className={`relative z-10 w-full ${ancho} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[92vh] flex flex-col`}>
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 id={idTitulo} className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                            {titulo}
                        </h3>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{subtitulo}</p>
                    </div>

                    <button type="button" onClick={() => void intentarCerrar()} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors" aria-label="Cerrar">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
            </div>
        </div>
    );
}
