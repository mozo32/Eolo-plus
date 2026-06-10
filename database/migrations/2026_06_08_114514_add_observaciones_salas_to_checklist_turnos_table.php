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
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->text('observaciones_salas')->nullable()->after('revision_salas');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->dropColumn('observaciones_salas');
        });
    }
};
