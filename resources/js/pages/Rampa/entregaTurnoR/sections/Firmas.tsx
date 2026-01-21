export default function Firmas() {
    return (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="mb-4 border-b pb-2 text-sm font-bold uppercase text-orange-600">
                Firmas
            </h3>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <input className="input w-full" placeholder="Firma quien entrega" />
                <input className="input w-full" placeholder="Enterado Jefe de Rampa" />
                <input className="input w-full" placeholder="Firma quien recibe" />
            </div>
        </div>
    );
}
