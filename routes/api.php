<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\BitacoraController;
use App\Http\Controllers\Api\DespachoController;
use App\Http\Controllers\Api\AeronaveController;
use App\Http\Controllers\Api\TipoAeronaveController;
use App\Http\Controllers\Api\WalkAroundController;
use App\Http\Controllers\Api\AdministracionController;
use App\Http\Controllers\Api\UserDepartamentoController;
use App\Http\Controllers\Api\EntregaTurnoController;
use App\Http\Controllers\Api\PernoctaDiaController;
use App\Http\Controllers\Api\PernoctaMesController;
use App\Http\Controllers\Api\EstacionamientoSubterraneoController;
use App\Http\Controllers\Api\ChecklistEquipoSeguridadController;
use App\Http\Controllers\Api\UsuarioController;
use App\Http\Controllers\Api\EntregaTurnoRController;
use App\Http\Controllers\Api\ChecklistTurnoController;
use App\Http\Controllers\Api\ControlMedicamentoController;
use App\Http\Controllers\Api\ServicioComisariatoController;
use App\Http\Controllers\Api\OperacionesDiariasController;
use App\Http\Controllers\Api\MovimientoCSAEController;
use App\Http\Controllers\Api\VehiculoEoloController;
use App\Http\Controllers\Api\RegistroVisitantesController;
use App\Http\Controllers\Api\RemisionController;
use App\Http\Controllers\Api\TurnoAutotanqueController;
use App\Http\Controllers\Api\InspeccioAutotanqueController;
use App\Http\Controllers\Api\NotaOperacionalController;
use App\Http\Controllers\Api\OperacionProgramadaController;
use App\Http\Controllers\Api\MatriculaRestringidaController;
use App\Http\Controllers\Api\PantallaProgramadasController;
use App\Http\Controllers\Api\RelacionPlantaController;
use App\Http\Controllers\Api\PrestamoChalecoController;
use App\Http\Controllers\Api\Facturacion\AeronaveFacturacionController;
use App\Http\Controllers\Api\Facturacion\CategoriaAeronaveController;
use App\Http\Controllers\Api\Facturacion\CategoriaServicioController;
use App\Http\Controllers\Api\Facturacion\ClienteController;
use App\Http\Controllers\Api\Facturacion\FormaPagoController;
use App\Http\Controllers\Api\Facturacion\PrecioCombustibleController;
use App\Http\Controllers\Api\Facturacion\PrefacturaController;
use App\Http\Controllers\Api\Facturacion\PrefacturaPagoController;
use App\Http\Controllers\Api\Facturacion\PrefacturaPdfController;
use App\Http\Controllers\Api\Facturacion\PrefacturaRenglonController;
use App\Http\Controllers\Api\Facturacion\ProveedorController;
use App\Http\Controllers\Api\Facturacion\ServicioController;
use App\Http\Controllers\Api\Facturacion\TipoMotorController;

Route::post('/despacho', [DespachoController::class, 'store']);
Route::get('/aeronaves/autocomplete', [AeronaveController::class, 'autocomplete']);
Route::get('/aeronaves/buscar/{matricula}', [AeronaveController::class, 'buscarPorMatricula']);
Route::get('/aeronaves/tipo/{matricula}', [AeronaveController::class, 'tipoAeronave']);
Route::get('/tipo-aeronaves', [TipoAeronaveController::class, 'index']);
Route::post('/aeronaves', [AeronaveController::class, 'store']);
Route::post('/nuevo-tipo-aeronaves', [TipoAeronaveController::class, 'newTipoAeronave']);
Route::middleware(['auth:sanctum'])->get(
    '/usuarios/buscar',[UsuarioController::class, 'buscar']
);
Route::middleware('auth:sanctum')
    ->prefix('bitacoras')
    ->name('bitacoras.')
    ->group(function () {
        Route::get('/', [BitacoraController::class, 'index'])
            ->name('index');

        Route::get('/filtros', [BitacoraController::class, 'filtros'])
            ->name('filtros');

        Route::get('/{bitacora}', [BitacoraController::class, 'show'])
            ->whereNumber('bitacora')
            ->name('show');
    });

Route::prefix('walkarounds')->group(function () {
    Route::get('/pendientes-firmar', [WalkAroundController::class, 'pendientesFirmar']);
    Route::get('/basurero', [WalkAroundController::class, 'basurero']);
    Route::get('/bitacora', [WalkAroundController::class, 'bitacora']);
    Route::get('/departamentos', [WalkAroundController::class, 'departamentos']);
    Route::get('/personal', [WalkAroundController::class, 'personal']);
    Route::get('/{id}/active', [WalkAroundController::class, 'active']);
    Route::get('/', [WalkAroundController::class, 'index']);        // fetchWalkarounds
    Route::post('/', [WalkAroundController::class, 'store']);       // guardarWalkAroundApi
    Route::get('/{walkAround}', [WalkAroundController::class, 'show']); // fetchWalkaroundDetalle
    Route::put('/{walkAround}', [WalkAroundController::class, 'update']); // EDITAR
    Route::put('/firma/{walkAround}', [WalkAroundController::class, 'updateFirma']);
    Route::patch('/{walkAround}', [WalkAroundController::class, 'update']); // opcional
    Route::delete('/{walkAround}', [WalkAroundController::class, 'destroy']); // deleteWalkaround
    Route::get('/buscar/{matricula}', [WalkAroundController::class, 'buscarPorMatricula']);
});

Route::middleware(['api', 'auth:sanctum'])->prefix('administracion')->group(function () {
    Route::get('/users', [AdministracionController::class, 'index']);
    // Solo los IDs del grupo filtrado, para seleccionar todo un departamento.
    Route::get('/users/ids', [AdministracionController::class, 'ids']);
    // Catalogo de departamentos con conteo de usuarios y sus subdepartamentos.
    Route::get('/departamentos', [AdministracionController::class, 'departamentos']);
    Route::get('/users/{user}/departamentos', [UserDepartamentoController::class, 'index']);

    Route::post('/users/departamentos-masivo', [UserDepartamentoController::class, 'storeMasivo']);
});

Route::middleware(['api', 'auth:sanctum'])->prefix('EntregarTurno')->group(function () {
    Route::get('/OperacionDiaria', [EntregaTurnoController::class, 'OperacionDiaria']);
    Route::get('/WalkAround', [EntregaTurnoController::class, 'WalkAround']);
    Route::get('/', [EntregaTurnoController::class, 'index']);
    Route::post('/', [EntregaTurnoController::class, 'store']);
    Route::get('/{entregarTurno}', [EntregaTurnoController::class, 'show']);
    Route::delete('/{entregarTurno}', [EntregaTurnoController::class, 'destroy']);
    Route::put('/{entregarTurno}', [EntregaTurnoController::class, 'update']);
    Route::put('/validacion/{entregarTurno}', [EntregaTurnoController::class, 'validate']);
});

Route::middleware(['api', 'auth:sanctum'])->prefix('PernoctaDia')->group(function () {
    Route::get('/', [PernoctaDiaController::class, 'index']);
    Route::post('/', [PernoctaDiaController::class, 'store']);
    Route::get('/matriculas/buscar', [PernoctaDiaController::class, 'buscar']);
    Route::get('/pernocta-anios', [PernoctaDiaController::class, 'anios']);
});

Route::middleware(['api', 'auth:sanctum'])
    ->prefix('PernoctaMes')
    ->group(function () {
        Route::get('/', [PernoctaMesController::class, 'index']);
    });

Route::middleware(['api', 'auth:sanctum'])->prefix('EstacionamientoSubTerraneo')->group(function () {
    Route::get('/',[EstacionamientoSubterraneoController::class, 'index']);
    Route::get('/alerta',[EstacionamientoSubterraneoController::class, 'vehiculosMasDeCincoDias']);
    Route::post('/',[EstacionamientoSubterraneoController::class, 'store'])->name('estacionamiento.store');
    Route::get('/detalle/{fecha}',[EstacionamientoSubterraneoController::class, 'show']);
    Route::get('/buscar-placas',[EstacionamientoSubterraneoController::class, 'buscarPlacas']);
    Route::get('/detalle-placa/{placa}',[EstacionamientoSubterraneoController::class, 'detallePorPlaca']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('ChecklistEquipoSeguridad')->group(function () {
    Route::post('/',[ChecklistEquipoSeguridadController::class, 'store']);
    Route::get('/',[ChecklistEquipoSeguridadController::class, 'index']);
    Route::get('/pendientes', [ChecklistEquipoSeguridadController::class, 'usuariosSinChecklist']);
    Route::get('/{ChecklistEquipoSeguridad}', [ChecklistEquipoSeguridadController::class, 'show']);
    Route::put('/{ChecklistEquipoSeguridad}', [ChecklistEquipoSeguridadController::class, 'update']);
    Route::get('/eliminar/{id}', [ChecklistEquipoSeguridadController::class, 'eliminar']);
});

Route::middleware(['api', 'auth:sanctum'])->prefix('EntregaTurnoR')->group(function () {
    Route::post('/',[EntregaTurnoRController::class, 'store']);
    Route::get('/entrega-turno-rampa', [EntregaTurnoRController::class, 'index'])->name('entrega.rampa.index');
    Route::get('/verificar-ultimo', [EntregaTurnoRController::class, 'verificarUltimoTurno']);
    Route::get('/usuarios/buscar', [EntregaTurnoRController::class, 'buscarUsuariosRampa']);
    Route::get('/pendientes-jefe', [EntregaTurnoRController::class, 'reportesPendientesJefe']);
    Route::get('/{entregaTurnoR}', [EntregaTurnoRController::class, 'show']);
    Route::put('/{entregaTurnoR}', [EntregaTurnoRController::class, 'update']);
    Route::put('/{entregaTurnoR}/firmas', [EntregaTurnoRController::class, 'updateFirmas']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('CheckListTurno')->group(function () {
    Route::get('TotalOperaciones', [ChecklistTurnoController::class, 'TotalOperaciones']);
    Route::get('pendiente',[ChecklistTurnoController::class, 'checkPendiente']);
    Route::get('listaPendientes',[ChecklistTurnoController::class, 'listaPendientes']);
    Route::post('notas/', [ChecklistTurnoController::class, 'storenota']);
    Route::get('indexNotas/',[ChecklistTurnoController::class, 'indexnota']);
    Route::put('aprobar/{id}', [ChecklistTurnoController::class, 'aprobarTurno']);
    Route::put('validarnota/{notaOperacional}', [ChecklistTurnoController::class, 'validarnota']);
    Route::get('/',[ChecklistTurnoController::class, 'index']);
    Route::post('/', [ChecklistTurnoController::class, 'store']);
    Route::get('eliminar/{id}', [ChecklistTurnoController::class, 'eliminar']);
    Route::get('/{checklistTurno}', [ChecklistTurnoController::class, 'show']);
    Route::put('/{checklistTurno}', [ChecklistTurnoController::class, 'update']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('ControlMedicamento')->group(function () {
    Route::get('/ultimosMovimientos',[ControlMedicamentoController::class, 'ultimosMovimientos']);
    Route::get('/personal',[ControlMedicamentoController::class, 'personal']);
    Route::get('/medicamentos/deshabilitados',[ControlMedicamentoController::class, 'medicamentosDeshabilitados']);
    Route::get('/exportar-pdf', [ControlMedicamentoController::class, 'exportarPdf']);
    Route::get('/medicamentos',[ControlMedicamentoController::class, 'medicamentos']);
    Route::post('/entregaMedicamento',[ControlMedicamentoController::class, 'storeEntrega']);
    Route::put('/medicamento/{id}',[ControlMedicamentoController::class, 'reabastecer']);
    Route::put('/medicamento/deshabilitar/{id}',[ControlMedicamentoController::class, 'deshabilitar']);
    Route::put('/medicamento/habilitar/{id}',[ControlMedicamentoController::class, 'habilitar']);
    Route::post('/medicamento/agregar', [ControlMedicamentoController::class, 'agregarMedicamento']);
    Route::post('/',[ControlMedicamentoController::class, 'store']);
    Route::get('/index',[ControlMedicamentoController::class, 'index']);
    Route::get('/current',[ControlMedicamentoController::class, 'current']);
    Route::put('/{controlMedicamento}',[ControlMedicamentoController::class, 'update']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('ServicioComisariato')->group(function () {
    Route::post('/',[ServicioComisariatoController::class, 'store']);
    Route::get('/',[ServicioComisariatoController::class, 'index']);
    Route::get('/{servicioComisariato}', [ServicioComisariatoController::class, 'show']);
    Route::put('/{servicioComisariato}',[ServicioComisariatoController::class, 'update']);
    Route::get('eliminar/{id}', [ServicioComisariatoController::class, 'eliminar']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('OperacionesDiarias')->group(function () {
    Route::get('/', [OperacionesDiariasController::class, 'index']);
    Route::get('/Excel/', [OperacionesDiariasController::class, 'obtenerExcel']);
    Route::get('/Pdf/', [OperacionesDiariasController::class, 'obtenerPdf']);
    Route::put('/{id}', [OperacionesDiariasController::class, 'update']);
    Route::post('/',[OperacionesDiariasController::class, 'store']);
    Route::get('/autocomplete', [OperacionesDiariasController::class, 'autocomplete']);
    Route::get('/buscar/{matricula}', [OperacionesDiariasController::class, 'buscarPorMatricula']);
    Route::get('/verificar', [OperacionesDiariasController::class, 'verificarExistente']);
    Route::get('/nombres/{matricula}', [OperacionesDiariasController::class, 'obtenerNombresPorMatricula']);
    Route::get('/pendientes', [OperacionesDiariasController::class, 'obtenerPendientes']);
    // Solo FBO: la verificación de rol vive en el controlador y responde 403.
    Route::patch('/{id}/cancelar', [OperacionesDiariasController::class, 'cancelar'])->whereNumber('id');
});
Route::middleware(['api', 'auth:sanctum'])->prefix('MovimientosCSAE')->group(function () {
    Route::get('/pendientes-salida',[MovimientoCSAEController::class, 'pendientesSalida']);
    Route::post('/',[MovimientoCSAEController::class, 'store']);
    Route::get('/',[MovimientoCSAEController::class, 'index']);
    Route::get('/{movimientoCSAE}', [MovimientoCSAEController::class, 'show']);
    Route::put('/{movimientoCSAE}',[MovimientoCSAEController::class, 'salida']);
    Route::get('eliminar/{id}', [MovimientoCSAEController::class, 'eliminar']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('VehiculoEolo')->group(function () {
    Route::get('/', [VehiculoEoloController::class, 'index']);
    Route::post('/movimientos', [VehiculoEoloController::class, 'registrarMovimiento']);
    Route::get('/vehiculos/{id}/movimientos', [VehiculoEoloController::class, 'obtenerHistorial']);
    Route::post('/', [VehiculoEoloController::class, 'store']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('RegistroVisitantes')->group(function () {
    Route::post('/', [RegistroVisitantesController::class, 'store']);
    Route::get('/pendientes', [RegistroVisitantesController::class,'pendientes']);
    Route::get('/', [RegistroVisitantesController::class, 'index']);
    Route::put('/{registroVisitante}', [RegistroVisitantesController::class, 'salida']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('Remision')->group(function () {
    Route::get('/Excel/', [RemisionController::class, 'obtenerExcel']);
    Route::post('/enviar-correo', [RemisionController::class, 'enviarCorreo']);
    Route::put('/vincularPrefactura', [RemisionController::class, 'vincularPrefactura']);
    Route::get('/ultimaLectura', [RemisionController::class, 'ultimaLectura']);
    Route::get('/combustibleAsa', [RemisionController::class, 'combustibleAsa']);
    Route::get('/formaPago', [RemisionController::class, 'formaPago']);
    Route::post('/remisiones', [RemisionController::class, 'store']);
    Route::get('/', [RemisionController::class, 'index']);
    Route::get('/{id}', [RemisionController::class, 'show']);
    Route::put('/{id}', [RemisionController::class, 'update']);
    Route::get('/matricula/{matricula}', [RemisionController::class, 'matriculaHora']);
    Route::get('/buscarResponsable/{matricula}', [RemisionController::class, 'obtenerResponsablesPorMatricula']);

});
Route::middleware(['api', 'auth:sanctum'])->prefix('TurnoAutoTanque')->group(function () {
    Route::post('/', [TurnoAutotanqueController::class, 'store']);
    Route::get('/Excel/', [TurnoAutotanqueController::class, 'obtenerExcel']);
    Route::get('/check-active', [TurnoAutotanqueController::class, 'checkActiveTurno']);
    Route::get('/ultimo-totalizador', [TurnoAutotanqueController::class, 'getLastTotalizador']);
    Route::put('/remisiones/{remision}/cancelar', [TurnoAutotanqueController::class, 'cancelarRemision']);
    Route::get('/', [TurnoAutotanqueController::class, 'index']);
    Route::get('/{id}', [TurnoAutotanqueController::class, 'show']);
    Route::get('/eliminarTurno/{id}', [TurnoAutotanqueController::class, 'eliminar']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('InspeccionAutoTanque')->group(function () {
    Route::post('/', [InspeccioAutotanqueController::class, 'store']);
    Route::get('/turno/{id}', [InspeccioAutotanqueController::class, 'showTurno']);
    Route::get('/Excel/', [InspeccioAutotanqueController::class, 'showExcel']);
    Route::post('/validar-color', [InspeccioAutotanqueController::class, 'validarColor']);
    Route::post('/guardar-inspeccion', [InspeccioAutotanqueController::class, 'guardarInspeccionCompleta']);
    Route::get('/index-inspeccion', [InspeccioAutotanqueController::class, 'indexCombustibles']);
    Route::get('/show-inspeccion/{id}', [InspeccioAutotanqueController::class, 'showCombustibles']);
    Route::post('/aprender-color', [InspeccioAutotanqueController::class, 'aprenderColorManual']);
    Route::get('/eliminar/{id}', [InspeccioAutotanqueController::class, 'eliminar']);
});



/*
|--------------------------------------------------------------------------
| Operaciones Programadas (Despacho)
|--------------------------------------------------------------------------
| Consultar es abierto a cualquier área autenticada, porque Operaciones
| Diarias y WalkAround necesitan leer las programadas pendientes.
| Crear, editar y eliminar queda restringido a Despacho y admin mediante el
| middleware subdep:operacionesProgramadas.
*/
Route::middleware(['api', 'auth:sanctum'])->prefix('OperacionesProgramadas')->group(function () {
    Route::get('/pendientes', [OperacionProgramadaController::class, 'pendientes']);
    Route::get('/coincidencias', [OperacionProgramadaController::class, 'coincidencias']);
    Route::post('/validar-movimiento', [OperacionProgramadaController::class, 'validarMovimiento']);
    Route::get('/', [OperacionProgramadaController::class, 'index']);
    Route::get('/{operacionProgramada}', [OperacionProgramadaController::class, 'show'])->whereNumber('operacionProgramada');

    Route::middleware('subdep:operacionesProgramadas')->group(function () {
        Route::post('/', [OperacionProgramadaController::class, 'store']);
        Route::put('/{operacionProgramada}', [OperacionProgramadaController::class, 'update'])->whereNumber('operacionProgramada');
        Route::post('/{operacionProgramada}/finalizar', [OperacionProgramadaController::class, 'finalizar'])->whereNumber('operacionProgramada');
        Route::delete('/{operacionProgramada}', [OperacionProgramadaController::class, 'destroy'])->whereNumber('operacionProgramada');
    });
});

/*
|--------------------------------------------------------------------------
| Pantalla pública de Operaciones Programadas (televisión)
|--------------------------------------------------------------------------
| Sin autenticación a propósito: la televisión no inicia sesión. Es solo
| lectura, devuelve únicamente los campos que se muestran y vive en un
| controlador aparte para no aflojar nada del administrativo.
*/
Route::middleware(['api', 'throttle:60,1'])
    ->get('/pantalla/operaciones-programadas', [PantallaProgramadasController::class, 'index']);

/*
|--------------------------------------------------------------------------
| Matrículas restringidas (Despacho)
|--------------------------------------------------------------------------
| El único consumidor es el modal de Operaciones Programadas, así que todo el
| grupo queda detrás de los permisos de Despacho, incluida la lectura.
*/
Route::middleware(['api', 'auth:sanctum'])
    ->prefix('MatriculasRestringidas')
    ->group(function () {
        // Consultar quién está restringido lo puede cualquiera que abra la
        // pantalla; cambiarlo sigue siendo de Despacho.
        Route::get('/', [MatriculaRestringidaController::class, 'index']);

        Route::middleware('subdep:operacionesProgramadas')->group(function () {
            Route::post('/', [MatriculaRestringidaController::class, 'store']);
            Route::put('/{matricula}', [MatriculaRestringidaController::class, 'update']);
            Route::delete('/{matricula}', [MatriculaRestringidaController::class, 'destroy']);
        });
    });

/*
|--------------------------------------------------------------------------
| Relación de planta (Rampa) — préstamo de la GPU N.115
|--------------------------------------------------------------------------
| Consultar es abierto a cualquier usuario autenticado. Prestar y finalizar
| exigen el subdepartamento relacionPlanta (admin siempre pasa).
*/
Route::middleware(['api', 'auth:sanctum'])->prefix('RelacionPlanta')->group(function () {
    Route::get('/actual', [RelacionPlantaController::class, 'actual']);
    Route::get('/historico', [RelacionPlantaController::class, 'historico']);
    Route::get('/empresas', [RelacionPlantaController::class, 'empresas']);

    Route::middleware('subdep:relacionPlanta')->group(function () {
        Route::post('/prestar', [RelacionPlantaController::class, 'prestar']);
        Route::patch('/{id}/finalizar', [RelacionPlantaController::class, 'finalizar'])->whereNumber('id');
    });
});

/*
|--------------------------------------------------------------------------
| Préstamo de chalecos (Tráfico)
|--------------------------------------------------------------------------
| Consultar el histórico y la foto de la INE es para cualquier usuario con
| sesión; registrar y devolver exigen el subdepartamento prestamoChalecos.
| La INE vive en disco privado: nunca se sirve como archivo público.
*/
Route::middleware(['api', 'auth:sanctum'])->prefix('PrestamoChalecos')->group(function () {
    Route::get('/personal', [PrestamoChalecoController::class, 'personal']);
    Route::get('/', [PrestamoChalecoController::class, 'index']);
    Route::get('/{id}/ine', [PrestamoChalecoController::class, 'ine'])->whereNumber('id');

    Route::middleware('subdep:prestamoChalecos')->group(function () {
        Route::post('/', [PrestamoChalecoController::class, 'store']);
        Route::patch('/{id}/devolver', [PrestamoChalecoController::class, 'devolver'])->whereNumber('id');
    });
});

/*
|--------------------------------------------------------------------------
| Facturación — catálogos de matrícula (1a) y de prefactura (1b)
|--------------------------------------------------------------------------
| Consultar es abierto a cualquier usuario autenticado. Escribir exige el
| subdepartamento de esa pantalla (admin siempre pasa).
*/
Route::middleware(['api', 'auth:sanctum'])->prefix('facturacion')->group(function () {
    Route::get('/categorias-aeronave', [CategoriaAeronaveController::class, 'index']);
    Route::get('/tipos-motor', [TipoMotorController::class, 'index']);
    Route::get('/precios-combustible', [PrecioCombustibleController::class, 'index']);
    Route::get('/precios-combustible/vigente', [PrecioCombustibleController::class, 'vigente']);
    Route::get('/aeronaves', [AeronaveFacturacionController::class, 'index']);
    Route::get('/clientes', [ClienteController::class, 'index']);
    Route::get('/servicios', [ServicioController::class, 'index']);
    Route::get('/categorias-servicio', [CategoriaServicioController::class, 'index']);
    Route::get('/formas-pago', [FormaPagoController::class, 'index']);
    Route::get('/proveedores', [ProveedorController::class, 'index']);
    Route::get('/prefacturas', [PrefacturaController::class, 'index']);
    Route::get('/prefacturas/llegadas-sin-facturar', [PrefacturaController::class, 'llegadasSinFacturar']);
    Route::get('/prefacturas/{id}', [PrefacturaController::class, 'show'])->whereNumber('id');

    // Imprimir no escribe nada, así que vive fuera del grupo de escritura; pero exige el
    // subdepartamento, porque emitir un documento es una acción del departamento.
    Route::get('/prefacturas/{id}/pdf', [PrefacturaPdfController::class, 'pdf'])
        ->middleware('subdep:factPrefacturas')->whereNumber('id');

    Route::get('/prefacturas/{id}/cotizacion', [PrefacturaPdfController::class, 'cotizacion'])
        ->middleware('subdep:factPrefacturas')->whereNumber('id');

    Route::middleware('subdep:factCategoriasAeronave')->group(function () {
        Route::post('/categorias-aeronave', [CategoriaAeronaveController::class, 'store']);
        Route::put('/categorias-aeronave/{id}', [CategoriaAeronaveController::class, 'update'])->whereNumber('id');
        Route::patch('/categorias-aeronave/{id}/desactivar', [CategoriaAeronaveController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/categorias-aeronave/{id}/reactivar', [CategoriaAeronaveController::class, 'reactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factTiposMotor')->group(function () {
        Route::post('/tipos-motor', [TipoMotorController::class, 'store']);
        Route::put('/tipos-motor/{id}', [TipoMotorController::class, 'update'])->whereNumber('id');
        Route::patch('/tipos-motor/{id}/desactivar', [TipoMotorController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/tipos-motor/{id}/reactivar', [TipoMotorController::class, 'reactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factCombustible')->group(function () {
        Route::post('/precios-combustible', [PrecioCombustibleController::class, 'store']);
    });

    Route::middleware('subdep:factAeronaves')->group(function () {
        Route::put('/aeronaves/{id}', [AeronaveFacturacionController::class, 'update'])->whereNumber('id');
    });

    Route::middleware('subdep:factClientes')->group(function () {
        Route::post('/clientes', [ClienteController::class, 'store']);
        Route::put('/clientes/{id}', [ClienteController::class, 'update'])->whereNumber('id');
        Route::patch('/clientes/{id}/desactivar', [ClienteController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/clientes/{id}/reactivar', [ClienteController::class, 'reactivar'])->whereNumber('id');
    });

    // Las categorías de servicio van bajo factServicios a propósito: son una
    // clasificación de los servicios y se administran desde la misma pantalla.
    Route::middleware('subdep:factServicios')->group(function () {
        Route::post('/servicios', [ServicioController::class, 'store']);
        Route::put('/servicios/{id}', [ServicioController::class, 'update'])->whereNumber('id');
        Route::patch('/servicios/{id}/desactivar', [ServicioController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/servicios/{id}/reactivar', [ServicioController::class, 'reactivar'])->whereNumber('id');
        Route::post('/categorias-servicio', [CategoriaServicioController::class, 'store']);
        Route::put('/categorias-servicio/{id}', [CategoriaServicioController::class, 'update'])->whereNumber('id');
        Route::patch('/categorias-servicio/{id}/desactivar', [CategoriaServicioController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/categorias-servicio/{id}/reactivar', [CategoriaServicioController::class, 'reactivar'])->whereNumber('id');
    });

    // Prefacturas (bloque 2). Una prefactura cerrada no se edita: lo hace cumplir cada
    // endpoint, no solo la pantalla.
    Route::middleware('subdep:factPrefacturas')->group(function () {
        Route::post('/prefacturas', [PrefacturaController::class, 'store']);
        Route::put('/prefacturas/{id}', [PrefacturaController::class, 'update'])->whereNumber('id');
        Route::patch('/prefacturas/{id}/cerrar', [PrefacturaController::class, 'cerrar'])->whereNumber('id');
        Route::patch('/prefacturas/{id}/notas', [PrefacturaController::class, 'notas'])->whereNumber('id');
        Route::post('/prefacturas/{id}/renglones', [PrefacturaRenglonController::class, 'store'])->whereNumber('id');
        Route::delete('/prefacturas/{id}/renglones/{renglon}', [PrefacturaRenglonController::class, 'destroy'])->whereNumber('id')->whereNumber('renglon');
        Route::patch('/prefacturas/{id}/renglones/{renglon}/cortesia', [PrefacturaRenglonController::class, 'cortesia'])->whereNumber('id')->whereNumber('renglon');
        Route::patch('/prefacturas/{id}/renglones/{renglon}/grupo', [PrefacturaRenglonController::class, 'grupo'])->whereNumber('id')->whereNumber('renglon');
        Route::patch('/prefacturas/{id}/estancia', [PrefacturaRenglonController::class, 'estancia'])->whereNumber('id');
        Route::patch('/prefacturas/{id}/internacional', [PrefacturaRenglonController::class, 'internacional'])->whereNumber('id');
        Route::patch('/prefacturas/{id}/descartar', [PrefacturaController::class, 'descartar'])->whereNumber('id');
        Route::post('/prefacturas/{id}/pagos', [PrefacturaPagoController::class, 'store'])->whereNumber('id');
        Route::post('/prefacturas/{id}/pagos/amex', [PrefacturaPagoController::class, 'amex'])->whereNumber('id');
        Route::delete('/prefacturas/{id}/pagos/{pago}', [PrefacturaPagoController::class, 'destroy'])->whereNumber('id')->whereNumber('pago');
    });

    Route::middleware('subdep:factFormasPago')->group(function () {
        Route::post('/formas-pago', [FormaPagoController::class, 'store']);
        Route::put('/formas-pago/{id}', [FormaPagoController::class, 'update'])->whereNumber('id');
        Route::patch('/formas-pago/{id}/desactivar', [FormaPagoController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/formas-pago/{id}/reactivar', [FormaPagoController::class, 'reactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factProveedores')->group(function () {
        Route::post('/proveedores', [ProveedorController::class, 'store']);
        Route::put('/proveedores/{id}', [ProveedorController::class, 'update'])->whereNumber('id');
        Route::patch('/proveedores/{id}/desactivar', [ProveedorController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/proveedores/{id}/reactivar', [ProveedorController::class, 'reactivar'])->whereNumber('id');
    });
});
