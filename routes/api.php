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
Route::get('/debug-broadcast', function () {
    return response()->json([
        'default' => config('broadcasting.default'),
        'driver' => config('broadcasting.connections.' . config('broadcasting.default') . '.driver'),
        'connection' => config('broadcasting.connections.' . config('broadcasting.default')),
        'env_broadcast_connection' => env('BROADCAST_CONNECTION'),
        'env_broadcast_driver' => env('BROADCAST_DRIVER'),
    ]);
});
Route::get('/test-broadcast', function () {
    event(new \App\Events\RemisionCreada(777));

    return response()->json([
        'ok' => true,
        'default' => config('broadcasting.default'),
        'driver' => config('broadcasting.connections.' . config('broadcasting.default') . '.driver'),
    ]);
});
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
    Route::post('/', [PernoctaDiaController::class, 'store']);
    Route::get('/matriculas/buscar', [PernoctaDiaController::class, 'buscar']);
    Route::get('/pernocta-anios', [PernoctaDiaController::class, 'anios']);
});
Route::middleware(['api', 'auth:sanctum'])->prefix('PernoctaMes')->group(function () {
    Route::get('/pernocta-mes', [PernoctaMesController::class, 'index']);
});

Route::middleware(['api', 'auth:sanctum'])->prefix('EstacionamientoSubTerraneo')->group(function () {
    Route::get('/',[EstacionamientoSubterraneoController::class, 'index']);
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
    Route::get('/medicamentos',[ControlMedicamentoController::class, 'medicamentos']);
    Route::post('/entregaMedicamento',[ControlMedicamentoController::class, 'storeEntrega']);
    Route::put('/medicamento/{id}',[ControlMedicamentoController::class, 'reabastecer']);
    Route::put('/medicamento/deshabilitar/{id}',[ControlMedicamentoController::class, 'deshabilitar']);
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
});
Route::middleware(['api', 'auth:sanctum'])->prefix('MovimientosCSAE')->group(function () {
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


