import { BulkSalesUpload } from '@/components/sales/BulkSalesUpload';

const RegisterSale = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">📊 Cargar Ventas</h1>
        <p className="text-muted-foreground text-lg">
          Sube un archivo CSV con las ventas de tu equipo
        </p>
      </div>

      <BulkSalesUpload />
    </div>
  );
};

export default RegisterSale;
