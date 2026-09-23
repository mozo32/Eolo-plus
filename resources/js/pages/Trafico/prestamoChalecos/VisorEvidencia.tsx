import { X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
    /** URL temporal (createObjectURL) de la imagen a mostrar. */
    url: string;
    alt: string;
    onCerrar: () => void;
}

/**
 * Visor de una evidencia ampliada. Recibe la URL ya creada por quien la
 * administra (formulario o tabla); aquí no se crea, guarda ni registra nada.
 */
export default function VisorEvidencia({ url, alt, onCerrar }: Props) {
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCerrar();
        };

        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onCerrar]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 p-4 animate-in fade-in duration-150" onClick={onCerrar}>
            <button
                type="button"
                onClick={onCerrar}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Cerrar"
            >
                <X size={22} />
            </button>
            <img src={url} alt={alt} className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
    );
}
