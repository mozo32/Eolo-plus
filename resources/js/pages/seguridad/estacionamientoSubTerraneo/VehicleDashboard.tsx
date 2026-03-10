import { useState, useEffect } from 'react';
import { Activity, FileText, Bell, Filter, Plus, X, ChevronRight } from 'lucide-react';
import { listarEstaSubTerraneo } from '@/stores/apiEstacionamientoSubterraneo';
import VehicleDetail from './VehicleDetail';
import RoundRegisterForm from './RoundRegisterForm';

interface MesRegistro {
    valor: string;
    label: string;
}

const VehicleDashboard = () => {
    // --- ESTADOS DE NAVEGACIÓN ---
    const [showForm, setShowForm] = useState(false);

    // --- ESTADOS DE DATOS ---
    const [meses, setMeses] = useState<MesRegistro[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const cargarMeses = async () => {
        try {
            setLoading(true);
            const response = await listarEstaSubTerraneo(filterMonth, filterYear) as any;
            const dataLlegada = Array.isArray(response) ? response : response.data;
            setMeses(dataLlegada || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarMeses();
    }, [filterMonth, filterYear]);

    const mesesFiltrados = meses.filter(m => {
        const [year, month] = m.valor.split('-');
        const matchMonth = filterMonth === '' || month === filterMonth;
        const matchYear = filterYear === '' || year === filterYear;
        return matchMonth && matchYear;
    });

    const añosUnicos = Array.from(new Set(meses.map(m => m.valor.split('-')[0]))).sort().reverse();

    const handleOpenDetail = (mes: any) => {
        setIsDetailOpen(true);
        setSelectedVehicle(mes.valor);
    };

    const resetFilters = () => {
        setFilterMonth('');
        setFilterYear('');
    };

    // --- RENDERIZADO CONDICIONAL ---
    // Si showForm es true, mostramos el formulario en lugar del dashboard
    if (showForm) {
        return (
            <RoundRegisterForm
                onClose={() => {
                    setShowForm(false);
                    cargarMeses();
                }}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#f1f5f9] text-slate-600 p-6 md:p-12 font-sans animate-in fade-in duration-500">
            <div className="max-w-5xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-[0.2em] mb-2">
                            <Activity size={16} />
                            <span>Historial de Vigilancia</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                            Registros por <span className="text-blue-600">Periodo</span>
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-slate-400 hover:text-blue-600 transition-all">
                            <Bell size={20} />
                        </button>
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                        >
                            <Plus size={20} />
                            <span>Nuevo Ingreso</span>
                        </button>
                    </div>
                </header>

                <div className="flex flex-col md:flex-row gap-4 mb-10">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Todos los meses</option>
                            <option value="01">Enero</option>
                            <option value="02">Febrero</option>
                            <option value="03">Marzo</option>
                            <option value="04">Abril</option>
                            <option value="05">Mayo</option>
                            <option value="06">Junio</option>
                            <option value="07">Julio</option>
                            <option value="08">Agosto</option>
                            <option value="09">Septiembre</option>
                            <option value="10">Octubre</option>
                            <option value="11">Noviembre</option>
                            <option value="12">Diciembre</option>
                        </select>

                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Todos los años</option>
                            {añosUnicos.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    {(filterMonth || filterYear) && (
                        <button
                            onClick={resetFilters}
                            className="flex items-center justify-center gap-2 bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                        >
                            <X size={18} />
                            <span>Limpiar</span>
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="inline-block w-8 h-8 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="font-bold text-slate-400 tracking-widest uppercase text-xs">Cargando Archivos...</p>
                        </div>
                    ) : mesesFiltrados.length > 0 ? (
                        mesesFiltrados.map((mes) => (
                            <div
                                key={mes.valor}
                                onClick={() => handleOpenDetail(mes)}
                                className="group bg-white border border-slate-200 rounded-[2rem] p-2 flex items-center justify-between hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="h-16 w-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 capitalize group-hover:text-blue-700 transition-colors">
                                            {mes.label}
                                        </h2>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                                            Periodo: {mes.valor}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center pr-6">
                                    <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] py-20 text-center">
                            <Filter className="mx-auto text-slate-300 mb-4" size={48} />
                            <p className="text-slate-400 font-bold text-lg">No hay registros para este filtro</p>
                        </div>
                    )}
                </div>

                <VehicleDetail
                    isOpen={isDetailOpen}
                    onClose={() => setIsDetailOpen(false)}
                    selectedVehicle={selectedVehicle}
                />
            </div>
        </div>
    );
};

export default VehicleDashboard;
