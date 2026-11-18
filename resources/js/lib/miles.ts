/**
 * Separador de miles para los campos que se capturan como texto pero son
 * números enteros, como el kilometraje de la flota.
 *
 * Lo que se guarda son siempre dígitos pelados ("3212"): la coma existe solo
 * al pintar. Así los reportes ya guardados se ven igual que los nuevos sin
 * tocar la base, y el dato sigue sirviendo para comparar o sumar.
 */

/** Deja únicamente los dígitos de un texto: "3,2a12" queda en "3212". */
export function soloDigitos(valor: string): string {
    return valor.replace(/\D/g, '');
}

/**
 * Pinta un entero con comas de millar, al estilo del resto del proyecto
 * ("en-US"): "3212" queda en "3,212".
 *
 * Devuelve cadena vacía cuando no hay número que mostrar, para que quien lo
 * use pueda caer en su propio guion con `|| '-'`.
 */
export function conMiles(valor?: string | number | null): string {
    const digitos = soloDigitos(String(valor ?? ''));

    if (digitos === '') {
        return '';
    }

    return Number(digitos).toLocaleString('en-US');
}
