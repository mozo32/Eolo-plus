import { useState, useEffect } from 'react';
import { Calendar, ChevronRight, FileText, Filter, Plus, X } from 'lucide-react';
import { listarEstaSubTerraneo } from '@/stores/apiEstacionamientoSubterraneo';
import VehicleDetail from './VehicleDetail';
import RoundRegisterForm from './RoundRegisterForm';

interface MesRegistro {
    valor: string;
    label: string;
}

const mesesOpciones = [
    { valor: '01', label: 'Enero' },
    { valor: '02', label: 'Febrero' },
    { valor: '03', label: 'Marzo' },
    { valor: '04', label: 'Abril' },
    { valor: '05', label: 'Mayo' },
    { valor: '06', label: 'Junio' },
    { valor: '07', label: 'Julio' },
    { valor: '08', label: 'Agosto' },
    { valor: '09', label: 'Septiembre' },
    { valor: '10', label: 'Octubre' },
    { valor: '11', label: 'Noviembre' },
    { valor: '12', label: 'Diciembre' },
];

const VehicleDashboard = () => {
    const [showForm, setShowForm] = useState(false);
    const [meses, setMeses] = useState<MesRegistro[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);

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

    const mesesFiltrados = meses.filter((m) => {
        const [year, month] = m.valor.split('-');
        const matchMonth = filterMonth === '' || month === filterMonth;
        const matchYear = filterYear === '' || year === filterYear;
        return matchMonth && matchYear;
    });

    const aniosUnicos = Array.from(new Set(meses.map((m) => m.valor.split('-')[0]))).sort().reverse();

    const handleOpenDetail = (mes: MesRegistro) => {
        setSelectedVehicle(mes.valor);
        setIsDetailOpen(true);
    };

    const resetFilters = () => {
        setFilterMonth('');
        setFilterYear('');
    };

    const obtenerMes = (valor: string) => {
        const month = valor?.split('-')?.[1];
        return mesesOpciones.find((m) => m.valor === month)?.label || 'N/A';
    };

    const obtenerAnio = (valor: string) => {
        return valor?.split('-')?.[0] || 'N/A';
    };

    const formatPeriodo = (valor: string) => {
        if (!valor) return 'N/A';

        const [year, month] = valor.split('-');

        if (!year || !month) return valor;

        return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('es-MX', {
            month: 'long',
            year: 'numeric',
        });
    };



    return (
        <div className="p-6 bg-[#f3f4f6] min-h-screen">
            <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                Registros por Periodo
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Historial de vigilancia
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${filtersOpen
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            <Filter size={14} />
                            <span>{filtersOpen ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                        >
                            <Plus size={14} />
                            NUEVO INGRESO
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-white border-b border-slate-100">
                                    <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-24">
                                        Periodo
                                    </th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                        Mes
                                    </th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                        Año
                                    </th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                        Descripción
                                    </th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">
                                        Acciones
                                    </th>
                                </tr>

                                <tr className={`bg-slate-50 transition-all duration-300 ease-in-out ${filtersOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                    <td className="px-2 py-2 border-b border-slate-200">
                                        <div className="w-full flex items-center justify-center gap-1 text-[10px] border border-slate-200 p-1.5 rounded bg-white text-slate-500 font-bold uppercase">
                                            <Calendar size={12} className="text-indigo-500" />
                                            Fecha
                                        </div>
                                    </td>

                                    <td className="px-2 py-2 border-b border-slate-200">
                                        <select
                                            value={filterMonth}
                                            onChange={(e) => setFilterMonth(e.target.value)}
                                            className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center font-bold text-slate-600"
                                        >
                                            <option value="">TODOS LOS MESES</option>
                                            {mesesOpciones.map((mes) => (
                                                <option key={mes.valor} value={mes.valor}>
                                                    {mes.label.toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="px-2 py-2 border-b border-slate-200">
                                        <select
                                            value={filterYear}
                                            onChange={(e) => setFilterYear(e.target.value)}
                                            className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center font-bold text-slate-600"
                                        >
                                            <option value="">TODOS LOS AÑOS</option>
                                            {aniosUnicos.map((year) => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="px-2 py-2 border-b border-slate-200">
                                        <div className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white text-slate-400 font-bold uppercase text-center">
                                            Historial mensual
                                        </div>
                                    </td>

                                    <td className="px-2 py-2 border-b border-slate-200 text-right">
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                            title="Limpiar filtros"
                                        >
                                            <X size={14} />
                                        </button>
                                    </td>
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Cargando datos...
                                        </td>
                                    </tr>
                                ) : mesesFiltrados.length > 0 ? (
                                    mesesFiltrados.map((mes) => (
                                        <tr
                                            key={mes.valor}
                                            className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                                            onClick={() => handleOpenDetail(mes)}
                                        >
                                            <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">
                                                {mes.valor}
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                                                        <FileText size={13} />
                                                    </div>

                                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                                                        {obtenerMes(mes.valor)}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border bg-indigo-50 text-indigo-600 border-indigo-200">
                                                    {obtenerAnio(mes.valor)}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">
                                                        Registro mensual
                                                    </span>
                                                    <span className="font-bold text-[10px] text-slate-800 capitalize">
                                                        {mes.label || formatPeriodo(mes.valor)}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenDetail(mes);
                                                        }}
                                                        className="p-2 rounded transition-colors text-slate-400 hover:text-sky-600"
                                                        title="Ver detalle"
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            No hay registros disponibles
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Mostrando {mesesFiltrados.length} de {meses.length} registros
                    </div>

                    {(filterMonth || filterYear) && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 text-slate-600 flex items-center gap-1 transition-colors"
                        >
                            <X size={14} />
                            LIMPIAR FILTROS
                        </button>
                    )}
                </div>
            </div>

            {isDetailOpen && (
                <VehicleDetail
                    isOpen={isDetailOpen}
                    onClose={() => setIsDetailOpen(false)}
                    selectedVehicle={selectedVehicle}
                />
            )}
            {showForm && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" />

                    <div
                        className="relative z-10 w-full max-w-7xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                    Nuevo Ingreso
                                </h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Registro de estacionamiento subterráneo
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    cargarMeses();
                                }}
                                className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                                title="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar bg-[#f3f4f6]">
                            <RoundRegisterForm
                                onClose={() => {
                                    setShowForm(false);
                                    cargarMeses();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleDashboard;
