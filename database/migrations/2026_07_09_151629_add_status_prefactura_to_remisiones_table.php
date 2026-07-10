<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('remisiones', 'status_prefactura')) {
            Schema::table('remisiones', function (Blueprint $table) {
                $table->boolean('status_prefactura')->default(false);
                $table->string('folio_orden_venta')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('remisiones', 'status_prefactura')) {
            Schema::table('remisiones', function (Blueprint $table) {
                $table->dropColumn('status_prefactura');
                $table->dropColumn('folio_orden_venta');
            });
        }
    }
};
