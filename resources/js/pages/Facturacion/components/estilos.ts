import Swal from 'sweetalert2';

// Clases de la tabla estándar de Tráfico (ServicioComisariato.tsx, Préstamo de chalecos).
export const TH = 'px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center';
export const TD = 'px-6 py-4 text-center';
export const FILTRO = 'w-full text-[10px] border border-slate-200 p-2 rounded bg-white outline-none focus:border-blue-400 uppercase';

// Formularios: mismas constantes que PrestamoChalecoForm.
export const inputStyle =
    'w-full rounded-lg border-2 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#00677F] focus:bg-white focus:ring-2 focus:ring-[#00677F]/20 focus:outline-none disabled:opacity-60';
export const labelStyle = 'mb-1 block text-xs font-extrabold uppercase text-slate-600';
export const sectionTitle = 'mb-4 text-xs font-extrabold uppercase tracking-widest text-[#00677F]';
export const errorStyle = 'mt-1 text-sm font-medium text-red-600';
export const campoConError = (conError: boolean) => `${inputStyle} ${conError ? 'border-red-400' : 'border-slate-300'}`;

export const BOTON_PRIMARIO =
    'text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100';
export const BOTON_SECUNDARIO = 'text-[10px] font-black px-4 py-2 rounded border transition-all bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50';

export const BADGE_ACTIVO = 'bg-emerald-100 text-emerald-600';
export const BADGE_BAJA = 'bg-slate-200 text-slate-500';

export const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

export const POR_PAGINA_OPCIONES = [10, 20, 50, 100] as const;
