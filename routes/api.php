<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

use Illuminate\Support\Facades\Route;
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

Route::post('/despacho', [DespachoController::class, 'store']);
Route::get('/aeronaves/autocomplete', [AeronaveController::class, 'autocomplete']);
Route::get('/aeronaves/buscar/{matricula}', [AeronaveController::class, 'buscarPorMatricula']);
Route::get('/tipo-aeronaves', [TipoAeronaveController::class, 'index']);
Route::post('/aeronaves', [AeronaveController::class, 'store']);
Route::post('/nuevo-tipo-aeronaves', [TipoAeronaveController::class, 'newTipoAeronave']);

Route::prefix('walkarounds')->group(function () {
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
});

Route::middleware(['api', 'auth:sanctum'])->prefix('administracion')->group(function () {
    Route::get('/users', [AdministracionController::class, 'index']);
    Route::get('/users/{user}/departamentos', [UserDepartamentoController::class, 'index']);
    Route::post('/users/{user}/departamentos', [UserDepartamentoController::class, 'store']);
});

Route::middleware(['api', 'auth:sanctum'])->prefix('EntregarTurno')->group(function () {
    Route::get('/', [EntregaTurnoController::class, 'index']);
    Route::post('/', [EntregaTurnoController::class, 'store']);
    Route::get('/{entregarTurno}', [EntregaTurnoController::class, 'show']);
    Route::delete('/{entregarTurno}', [EntregaTurnoController::class, 'destroy']);
    Route::put('/{entregarTurno}', [EntregaTurnoController::class, 'update']);
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
        Route::get('/',[EstacionamientoSubterraneoController::class, 'index'])->name('estacionamiento.index');
        Route::post('/',[EstacionamientoSubterraneoController::class, 'store'])->name('estacionamiento.store');
        Route::put('/{estacionamiento}/salida',[EstacionamientoSubterraneoController::class, 'updateSalida'])->name('estacionamiento.salida');
        Route::get('/{estacionamiento}',[EstacionamientoSubterraneoController::class, 'show'])->name('estacionamiento.show');
});

