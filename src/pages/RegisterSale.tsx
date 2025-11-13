import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSales } from '@/context/SalesContext';
import { useConfig } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import XPPreview from '@/components/sales/XPPreview';
import { useNavigate } from 'react-router-dom';

const RegisterSale = () => {
  const { user } = useAuth();
  const { registerSale } = useSales();
  const { products } = useConfig();
  const navigate = useNavigate();

  const [selectedUser, setSelectedUser] = useState<number>(user?.id || 0);
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [client, setClient] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === 'EJECUTIVO') {
      setSelectedUser(user.id);
    }
  }, [user]);

  const selectedProduct = products.find(p => p.id === productId);
  const activeMultiplier = user?.activeMultipliers?.[0]?.multiplier || null;

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(999, prev + delta)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !user) return;

    setIsSubmitting(true);

    const baseXP = (selectedProduct?.xp || 0) * quantity;
    const finalXP = activeMultiplier ? baseXP * activeMultiplier : baseXP;

    registerSale({
      userId: selectedUser,
      productId,
      productName: selectedProduct?.name || '',
      quantity,
      xpEarned: finalXP,
      multiplierApplied: activeMultiplier,
      client: client || null,
      date,
      notes: notes || null,
      registeredBy: user.id,
    });

    setTimeout(() => {
      setIsSubmitting(false);
      navigate('/dashboard');
    }, 500);
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">💰 Registrar Nueva Venta</h1>
        <p className="text-muted-foreground text-lg">
          ¡Cada venta te acerca a tu próximo nivel!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Executive Info */}
          <Card className="p-6 shadow-smooth-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>👤</span> Información del Ejecutivo
            </h2>
            
            {user?.role === 'EJECUTIVO' ? (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-2xl">
                  {user.avatar}
                </div>
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.level} • {user.xp} XP
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Label>Ejecutivo</Label>
                <Select value={selectedUser.toString()} onValueChange={(v) => setSelectedUser(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar ejecutivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={user?.id.toString() || '0'}>
                      {user?.name} (Tú)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>

          {/* Section 2: Sale Details */}
          <Card className="p-6 shadow-smooth-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>📦</span> Detalles de la Venta
            </h2>
            
            <div className="space-y-4">
              {/* Product */}
              <div>
                <Label>Producto *</Label>
                <Select value={productId?.toString()} onValueChange={(v) => setProductId(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                          {category}
                        </div>
                        {products.filter(p => p.category === category).map(product => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} (+{product.xp} XP) ⭐
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div>
                <Label>Cantidad *</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="text-center text-lg font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Client */}
              <div>
                <Label>Cliente (opcional)</Label>
                <Input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Nombre del cliente"
                />
              </div>

              {/* Date */}
              <div>
                <Label>Fecha de venta *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Notes */}
              <div>
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles adicionales de la venta..."
                  rows={3}
                />
              </div>
            </div>
          </Card>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              size="lg"
              className="flex-1 font-bold text-lg"
              disabled={!productId || isSubmitting}
            >
              {isSubmitting ? 'Registrando...' : '✅ Registrar Venta'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate('/dashboard')}
            >
              ❌ Cancelar
            </Button>
          </div>
        </form>

        {/* Preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <XPPreview
            productId={productId}
            quantity={quantity}
            currentUser={user!}
            activeMultiplier={activeMultiplier}
          />
        </div>
      </div>
    </div>
  );
};

export default RegisterSale;