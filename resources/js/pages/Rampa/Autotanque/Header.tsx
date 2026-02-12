import { ClipboardList } from 'lucide-react';

export const Header = () => (
    <header className="bg-blue-900 text-white p-6 rounded-t-lg flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold tracking-widest">EOLO</h1>
            <p className="text-sm opacity-80">REPORTE DE ENTREGA DE TURNO - AUTOTANQUE</p>
        </div>
        <ClipboardList size={40} />
    </header>
);
