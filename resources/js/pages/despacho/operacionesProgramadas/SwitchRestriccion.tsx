interface Props {
    activo: boolean;
    deshabilitado?: boolean;
    etiqueta: string;
    onCambiar: (valor: boolean) => void;
}

/**
 * Switch propio en Tailwind. El proyecto no tiene uno y sus componentes son
 * todos Tailwind a mano, así que se sigue ese mismo lenguaje en vez de traer
 * una librería de UI nueva.
 *
 * Encendido significa movimiento restringido, por eso el color activo es rojo.
 */
export default function SwitchRestriccion({ activo, deshabilitado = false, etiqueta, onCambiar }: Props) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label={etiqueta}
            disabled={deshabilitado}
            onClick={() => onCambiar(!activo)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00677F] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                activo ? 'bg-red-600' : 'bg-slate-300'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    activo ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    );
}
