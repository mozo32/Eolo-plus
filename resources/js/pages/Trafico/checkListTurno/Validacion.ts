import Swal from "sweetalert2";

/**
 * Obtiene un valor usando path tipo "a.b.c"
 */
const getValueByPath = (obj: any, path: string) => {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
};

/**
 * Campos requeridos por paso
 */
const requiredFieldsByStep: Record<number, { path: string; label: string }[]> = {
    1: [
        { path: "nombreEmpleado", label: "Nombre del empleado" },
        { path: "fecha", label: "Fecha" },
    ],
    5: [
        { path: "cantidad_operaciones", label: "Cantidad de operaciones" },
        { path: "cantidad_pasajeros", label: "Cantidad de pasajeros" },
    ],
};

/**
 * Valida un paso del formulario
 */
export const validarPaso = (form: any, step: number): boolean => {
    const requiredFields = requiredFieldsByStep[step] || [];
    const errores: string[] = [];

    requiredFields.forEach(({ path, label }) => {
        const value = getValueByPath(form, path);

        const isEmpty =
            value === "" ||
            value === null ||
            value === undefined ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === "object" &&
                !Array.isArray(value) &&
                Object.keys(value).length === 0);

        if (isEmpty) {
            errores.push(label);
        }
    });

    if (errores.length > 0) {
        Swal.fire({
            icon: "warning",
            title: "Campos incompletos",
            html: `
                <p class="mb-2">Debes completar los siguientes campos:</p>
                <ul style="text-align:left;">
                    ${errores.map(e => `<li>• ${e}</li>`).join("")}
                </ul>
            `,
            confirmButtonColor: "#00677F",
        });

        return false;
    }

    return true;
};
