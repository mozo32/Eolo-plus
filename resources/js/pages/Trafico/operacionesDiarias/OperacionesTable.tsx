export const OperacionesTable = () => {
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Registro de Operaciones Diarias</h2>

      {/* Tabs */}
      <div className="flex space-x-4 border-b mb-4">
        <button className="py-2 px-4 border-b-2 border-blue-500 font-medium">Llegadas</button>
        <button className="py-2 px-4 text-gray-500">Salidas</button>
      </div>

      {/* Tabla */}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-3 border-b">Matrícula</th>
            <th className="p-3 border-b">Equipo</th>
            <th className="p-3 border-b">Hora</th>
            <th className="p-3 border-b">Procedencia</th>
            <th className="p-3 border-b">Pax</th>
            <th className="p-3 border-b">Estado</th>
            <th className="p-3 border-b">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {/* Aquí mapearías tus datos estáticos */}
          <tr className="hover:bg-gray-50">
            <td className="p-3 font-bold text-blue-600">XA-VAB</td>
            <td className="p-3">A320</td>
            <td className="p-3">08:30</td>
            <td className="p-3">MEX</td>
            <td className="p-3">145</td>
            <td className="p-3">
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pendiente</span>
            </td>
            <td className="p-3">
              <button className="text-sm bg-indigo-600 text-white px-3 py-1 rounded">Validar / Editar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
