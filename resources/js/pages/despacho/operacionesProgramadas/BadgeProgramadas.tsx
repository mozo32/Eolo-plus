interface Props {
    total: number;
}

/**
 * Contador de operaciones programadas pendientes de hoy, sobre el botón que
 * abre el panel. Se oculta cuando no hay ninguna.
 */
export default function BadgeProgramadas({ total }: Props) {
    if (total <= 0) return null;

    return (
        <span
            role="status"
            aria-live="polite"
            aria-label={`${total} ${total === 1 ? 'operación programada pendiente' : 'operaciones programadas pendientes'} para hoy`}
            className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow"
        >
            {total > 99 ? '99+' : total}
        </span>
    );
}
