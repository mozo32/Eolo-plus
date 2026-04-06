import Swal from 'sweetalert2';

// Validación Paso 1
export const validateStepOne = (infoData: any): boolean => {
    const missingFields: string[] = [];

    if (!infoData.matricula) missingFields.push("<b>Matrícula</b>");
    if (!infoData.movimiento) missingFields.push("<b>Movimiento</b>");
    if (!infoData.aeronave) missingFields.push("<b>Tipo de Aeronave</b>");
    if (!infoData.tipo) missingFields.push("<b>Modelo/Tipo</b>");
    if (!infoData.hora) missingFields.push("<b>Hora</b>");
    if (infoData.movimiento === 'Entrada' && !infoData.procedencia) missingFields.push("<b>Procedencia</b>");
    if (infoData.movimiento === 'Salida' && !infoData.destino) missingFields.push("<b>Destino</b>");

    if (missingFields.length > 0) {
        showWarningAlert('Campos incompletos', 'Para continuar, debe llenar los siguientes campos:', missingFields);
        return false;
    }
    return true;
};

// Validación Paso 2
// Validación Paso 2
export const validateStepTwo = (inspeccion: any, currentItems: string[]): boolean => {
    const missingFields: string[] = [];

    // 1. Validar Número de Estáticas
    if (inspeccion.numeroEstaticas === undefined || inspeccion.numeroEstaticas === '') {
        missingFields.push("<b>Número de Estáticas</b>");
    }

    // 2. Validar cada componente
    currentItems.forEach(item => {
        const data = inspeccion[item];

        if (!data) {
            missingFields.push(`Estado de: <b>${item}</b>`);
            return;
        }

        const hasDamages = data.damages && data.damages.length > 0;
        const sideSelected = data.izq || data.der;

        if (hasDamages && !sideSelected) {
            missingFields.push(`Elige un lado (izq/der) para el daño en: <b>${item}</b>`);
        }
        else if (!hasDamages) {
            missingFields.push(`Registre los hallazgos técnicos de: <b>${item}</b>`);
        }
    });

    if (missingFields.length > 0) {
        showWarningAlert(
            'Inspección incompleta',
            'Debe completar los siguientes registros técnicos:',
            missingFields
        );
        return false;
    }
    return true;
};
export const validateStepThree = (exteriorData: any): boolean => {
    const missingFields: string[] = [];

    // Solo validamos al Responsable como obligatorio
    if (!exteriorData.nombreResponsable || exteriorData.nombreResponsable.trim() === "") {
        missingFields.push("<b>Nombre del Responsable</b>");
    }

    if (missingFields.length > 0) {
        showWarningAlert(
            'Falta Firma Obligatoria',
            'El responsable de la inspección debe identificarse para finalizar:',
            missingFields
        );
        return false;
    }

    return true;
};
// Función auxiliar para alertas estéticas
const showWarningAlert = (title: string, text: string, list: string[]) => {
    Swal.fire({
        title: title,
        html: `
            <div class="text-left mt-4">
                <p class="mb-3 text-slate-600">${text}</p>
                <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 14px;">
                    ${list.map(f => `<div style="margin-bottom: 4px;"><span style="color: #4f46e5;">•</span> ${f}</div>`).join('')}
                </div>
            </div>
        `,
        icon: 'warning',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-[20px]', confirmButton: 'rounded-xl px-10 py-3 text-sm' }
    });
};
