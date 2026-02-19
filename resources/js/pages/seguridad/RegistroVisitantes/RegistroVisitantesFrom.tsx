import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { Clock, User, Building2, ShieldCheck, CreditCard, CheckCircle2, ChevronRight } from 'lucide-react';
import { guardarRegistroVisitantes } from '@/stores/apiRegistroVisitantes';
import Swal from 'sweetalert2';

interface Props {
    onSuccess?: () => void;
}

type Role = {
    slug: string;
    nombre: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: {
            id: number;
            nombre: string;
            route: string;
        }[];
    }[];
};

const RegistroVisitantesForm = ({ onSuccess }: Props) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const [formData, setFormData] = useState({
        nombre: '',
        procedencia: '',
        a_quien_visita: '',
        gafete: '',
        empresa: 'Eolo plus',
        autoriza: auth?.user?.name ?? "",
    });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const dataForm = {
            ...formData,
            horaEntrada: timeString,
            fechaRegistro: currentTime
        };
        try {
            Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
            await guardarRegistroVisitantes(dataForm);

            await Swal.fire({
                icon: 'success',
                title: 'Guardado correctamente',
                timer: 1200,
                showConfirmButton: false,
            });
            if (onSuccess) {
                onSuccess();
            }
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
        }
    };

    const timeString = currentTime.toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    const formFields = [
        { label: '¿Cómo te llamas?', icon: User, placeholder: 'Nombre completo', name: 'nombre' },
        { label: '¿De dónde vienes?', icon: Building2, placeholder: 'Empresa / Procedencia', name: 'procedencia' },
        { label: '¿Quién te recibe?', icon: ShieldCheck, placeholder: 'Persona a quien visita', name: 'a_quien_visita' },
        { label: 'N. de Gafete', icon: CreditCard, placeholder: 'Asignado por seguridad', name: 'gafete' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center font-sans">
            <div className="max-w-5xl w-full flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/3 flex flex-col gap-6">
                    <div className="bg-blue-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-blue-200 relative overflow-hidden flex-1 flex flex-col justify-between">
                        <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-blue-500 rounded-full opacity-50"></div>

                        <div className="relative z-10">
                            <h1 className="text-5xl font-black leading-tight tracking-tighter mb-4">
                                HOLA.<br />REGÍSTRATE.
                            </h1>
                            <div className="h-2 w-16 bg-yellow-400 rounded-full mb-8"></div>
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="bg-blue-700/50 backdrop-blur-md rounded-2xl p-4 border border-blue-500/30">
                                <p className="text-xs font-medium text-blue-100 italic">
                                    "Tu seguridad es nuestra prioridad en Eolo Plus."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:w-2/3 space-y-6">
                    <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                Pase de Acceso <CheckCircle2 className="text-blue-600" size={24} />
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                            {formFields.map((field, idx) => (
                                <div key={idx} className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <field.icon size={14} className="text-blue-500" /> {field.label}
                                    </label>
                                    <input
                                        type="text"
                                        name={field.name}
                                        value={formData[field.name as keyof typeof formData]}
                                        onChange={handleChange}
                                        placeholder={field.placeholder}
                                        required
                                        className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl py-4 px-6 outline-none transition-all text-slate-700 font-semibold placeholder:text-slate-300 shadow-sm"
                                    />
                                </div>
                            ))}
                            <div className="md:col-span-2 space-y-4 pt-4">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest text-center block">Firma en el recuadro gris</label>
                                <div className="w-full h-44 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] relative flex items-center justify-center group hover:border-blue-200 transition-all cursor-crosshair overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>
                                    <span className="relative z-10 text-slate-300 font-bold uppercase tracking-tighter text-sm group-hover:scale-110 transition-transform italic">
                                        Área de Firma Digital
                                    </span>
                                </div>
                            </div>
                            <div className="md:col-span-2 pt-4">
                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-4 active:scale-95 text-lg group"
                                >
                                    LISTO, REGISTRAR MI ENTRADA
                                    <ChevronRight size={24} className="group-hover:translate-x-2 transition-transform" />
                                </button>
                            </div>
                        </form>
                    </div>
                    <p className="text-center text-slate-300 font-bold text-[10px] tracking-[0.3em] uppercase">
                        Sistema de Gestión Eolo Plus © 2026
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegistroVisitantesForm;
