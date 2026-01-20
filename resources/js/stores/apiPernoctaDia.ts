import Swal from "sweetalert2";

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export async function guardarPernoctaDiaApi(form: any) {
    const xsrf = getXsrfToken();

    const res = await fetch("/api/PernoctaDia", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": xsrf,
        },
        body: JSON.stringify(form),
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        Swal.fire({
            icon: "error",
            title: "Error",
            text: data?.message || "Error al guardar la pernocta del día",
        });

        throw new Error(data?.message || "Error al guardar la pernocta del día");
    }

    Swal.fire({
        icon: "success",
        title: "Proceso exitoso",
        text: data.message,
    });

    return data;
}
