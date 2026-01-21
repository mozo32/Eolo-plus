export default function Acciones() {
    return (
        <div className="flex justify-end gap-3">
            <button type="reset" className="rounded-lg border px-4 py-2 text-sm">
                Limpiar
            </button>

            <button
                type="submit"
                className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
                Guardar Entrega
            </button>
        </div>
    );
}
