<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('entrega_turno_r', function (Blueprint $table) {
            $table->string('nombre_entrega')->nullable()->after('aeronaves');
            $table->string('nombre_jefe_area')->nullable()->after('nombre_entrega');
            $table->string('nombre_recibe')->nullable()->after('nombre_jefe_area');
            $table->unsignedBigInteger('user_id')->nullable()->after('nombre_recibe');
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('entrega_turno_r', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['nombre_entrega', 'nombre_jefe_area', 'nombre_recibe', 'user_id']);
        });
    }
};
