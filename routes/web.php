<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

// Vista pública para televisión: sin sesión, sin layout y de solo lectura.
// Sus datos salen de un endpoint público propio que expone únicamente lo que
// se muestra; todo lo administrativo sigue detrás de auth.
Route::get('operacionesProgramadas/pantalla', function () {
    return Inertia::render('despacho/PantallaOperacionesProgramadas');
})->name('pantallaProgramadas');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('walkAround', function () {
        return Inertia::render('despacho/WalkAround');
    })->name('walkAround');

    Route::get('entregaTurno', function () {
        return Inertia::render('despacho/EntregaTurno');
    })->name('entregaTurno');

    Route::get('operacionesProgramadas', function () {
        return Inertia::render('despacho/OperacionesProgramadas');
    })->name('operacionesProgramadas');

    Route::get('gestionarAeronaves', function () {
        return Inertia::render('despacho/GestionAeronaves');
    })->name('gestionarAeronaves');

    Route::get('gestionUsuarios', function () {
        return Inertia::render('administracion/GestionUsuarios');
    })->name('gestionUsuarios');

    Route::get('pernoctadia', function () {
        return Inertia::render('seguridad/PernoctaDia');
    })->name('pernoctadia');

    Route::get('pernoctames', function () {
        return Inertia::render('comercial/PernoctaMes');
    })->name('pernoctames');

    Route::get('estacionamiento', function () {
        return Inertia::render('seguridad/EstacionamientoSubTerraneo');
    })->name('estacionamiento');

    Route::get('entregaTurnoR', function () {
        return Inertia::render('Rampa/EntregaTurnoR');
    })->name('entregaTurnoR');

    Route::get('asistenciaPersonal', function () {
        return Inertia::render('Rampa/AsistenciaPersonal');
    })->name('asistenciaPersonal');

    Route::get('checkListEquipo', function () {
        return Inertia::render('Rampa/CheckListEquipo');
    })->name('checkListEquipo');

    Route::get('checkListTurno', function () {
        return Inertia::render('Trafico/CheckListTurno');
    })->name('checkListTurno');

    Route::get('controlMedicamento', function () {
        return Inertia::render('Trafico/ControlMedicamento');
    })->name('controlMedicamento');

    Route::get('operacionesDiarias', function () {
        return Inertia::render('Trafico/OperacionesDiarias');
    })->name('operacionesDiarias');

    Route::get('servicioComisariato', function () {
        return Inertia::render('Trafico/ServicioComisariato');
    })->name('servicioComisariato');

    // Prototipo solo frontend (Tráfico): renderiza la vista con datos simulados,
    // sin tocar la base de datos. El backend se agregará al aprobar el diseño.
    Route::get('prestamoChalecos', function () {
        return Inertia::render('Trafico/PrestamoChalecos');
    })->name('prestamoChalecos');

    Route::get('movimientoAvionesCSAE', function () {
        return Inertia::render('seguridad/MovimientoAvionesCSAE');
    })->name('movimientoAvionesCSAE');

    Route::get('movimientosVehiculoEolo', function () {
        return Inertia::render('seguridad/MovimientosVehiculoEolo');
    })->name('movimientosVehiculoEolo');

    Route::get('reporteEntregaTurno', function () {
        return Inertia::render('Rampa/ReporteEntregaTurno');
    })->name('reporteEntregaTurno');

    Route::get('verificacionEstadoAutotanque', function () {
        return Inertia::render('Rampa/VerificacionEstadoAutotanque');
    })->name('verificacionEstadoAutotanque');

    Route::get('remision', function () {
        return Inertia::render('Rampa/Remision');
    })->name('remision');

    Route::get('relacionPlanta', function () {
        return Inertia::render('Rampa/RelacionPlanta');
    })->name('relacionPlanta');

    Route::get('registroVisitantes', function () {
        return Inertia::render('seguridad/RegistroVisitantes');
    })->name('registroVisitantes');

    Route::get('inspeccionCombustible', function () {
        return Inertia::render('Rampa/InspeccionCombustible');
    })->name('inspeccionCombustible');

    // Facturación (bloque 1a). Cada pantalla tiene su propio subdepartamento.
    Route::get('facturacion/aeronaves', fn () => Inertia::render('Facturacion/AeronavesFacturacion'))->name('facturacionAeronaves');
    Route::get('facturacion/categorias-aeronave', fn () => Inertia::render('Facturacion/CategoriasAeronave'))->name('facturacionCategoriasAeronave');
    Route::get('facturacion/tipos-motor', fn () => Inertia::render('Facturacion/TiposMotor'))->name('facturacionTiposMotor');
    Route::get('facturacion/combustible', fn () => Inertia::render('Facturacion/Combustible'))->name('facturacionCombustible');
    Route::get('facturacion/clientes', fn () => Inertia::render('Facturacion/Clientes'))->name('facturacionClientes');
    Route::get('facturacion/servicios', fn () => Inertia::render('Facturacion/Servicios'))->name('facturacionServicios');
    Route::get('facturacion/formas-pago', fn () => Inertia::render('Facturacion/FormasPago'))->name('facturacionFormasPago');
    Route::get('facturacion/proveedores', fn () => Inertia::render('Facturacion/Proveedores'))->name('facturacionProveedores');
});

require __DIR__.'/settings.php';
