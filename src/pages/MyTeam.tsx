import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSales } from '@/context/SalesContext';
import { useConfig } from '@/context/ConfigContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Trophy, 
  TrendingUp, 
  Star, 
  Flame,
  Shield,
  Target,
  Crown,
  Plus,
  Pencil,
  Trash2,
  UserPlus
} from 'lucide-react';
import { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const executiveSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').or(z.literal('')).optional(),
  country: z.string().min(1, 'Selecciona un país'),
  segment: z.string().min(1, 'Selecciona un segmento'),
  cellId: z.string().min(1, 'Selecciona una célula'),
});

type ExecutiveFormData = z.infer<typeof executiveSchema>;

const COUNTRIES = ['México', 'Colombia', 'Chile', 'Perú', 'Argentina', 'Brasil'];
const SEGMENTS = ['Enterprise', 'SMB', 'Startup', 'Government'];
const CELLS = ['CEL-001', 'CEL-002', 'CEL-003'];

const MyTeam = () => {
  const { user, isAuthenticated, users, addUser, updateUser, deleteUser } = useAuth();
  const { getSalesByUser } = useSales();
  const { getLevelByXP, levels } = useConfig();
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [deletingMember, setDeletingMember] = useState<User | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExecutiveFormData>({
    resolver: zodResolver(executiveSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      country: '',
      segment: '',
      cellId: '',
    },
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Solo gerentes pueden ver esta página
  if (user?.role !== 'GERENTE') {
    return (
      <Layout title="Mi Equipo">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="p-12 shadow-smooth-xl border-2 text-center max-w-md">
            <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Acceso Restringido
            </h2>
            <p className="text-muted-foreground">
              Esta sección está disponible solo para gerentes.
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  // Obtener ejecutivos del equipo del gerente actual
  const teamMembers = users.filter(
    (u) => u.role === 'EJECUTIVO' && u.managerId === user.id
  );

  // Calcular estadísticas del equipo
  const teamStats = {
    totalMembers: teamMembers.length,
    totalXP: teamMembers.reduce((acc, member) => acc + (member.xp || 0), 0),
    avgXP: teamMembers.length > 0 
      ? Math.round(teamMembers.reduce((acc, member) => acc + (member.xp || 0), 0) / teamMembers.length)
      : 0,
    totalSales: teamMembers.reduce((acc, member) => acc + getSalesByUser(String(member.id)).length, 0),
  };

  // Ordenar por XP para mostrar ranking
  const sortedMembers = [...teamMembers].sort((a, b) => (b.xp || 0) - (a.xp || 0));

  const getNextLevel = (currentXP: number) => {
    const sortedLevels = [...levels].sort((a, b) => a.minXP - b.minXP);
    const nextLevel = sortedLevels.find(l => l.minXP > currentXP);
    return nextLevel;
  };

  const getProgressToNextLevel = (currentXP: number) => {
    const currentLevel = getLevelByXP(currentXP);
    const nextLevel = getNextLevel(currentXP);
    
    if (!nextLevel || !currentLevel) return 100;
    
    const xpInCurrentLevel = currentXP - currentLevel.minXP;
    const xpNeededForNext = nextLevel.minXP - currentLevel.minXP;
    
    return Math.min(100, (xpInCurrentLevel / xpNeededForNext) * 100);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>;
  };

  const handleOpenAddDialog = () => {
    reset({
      name: '',
      email: '',
      password: '',
      country: '',
      segment: '',
      cellId: user.cellId || 'CEL-001',
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (member: User) => {
    reset({
      name: member.name,
      email: member.email,
      password: '',
      country: member.country || '',
      segment: member.segment || '',
      cellId: member.cellId || '',
    });
    setEditingMember(member);
  };

  const handleCloseDialogs = () => {
    setIsAddDialogOpen(false);
    setEditingMember(null);
    reset();
  };

  const onSubmitAdd = (data: ExecutiveFormData) => {
    addUser({
      name: data.name,
      email: data.email,
      password: data.password || 'ejecutivo123',
      role: 'EJECUTIVO',
      managerId: user.id,
      avatar: '👤',
      country: data.country,
      segment: data.segment,
      cellId: data.cellId,
    });
    
    toast({
      title: 'Ejecutivo agregado',
      description: `${data.name} ha sido agregado a tu equipo.`,
    });
    
    handleCloseDialogs();
  };

  const onSubmitEdit = (data: ExecutiveFormData) => {
    if (!editingMember) return;

    const updateData: Partial<User> & { password?: string } = {
      name: data.name,
      email: data.email,
      country: data.country,
      segment: data.segment,
      cellId: data.cellId,
    };

    if (data.password && data.password.length >= 6) {
      updateData.password = data.password;
    }

    updateUser(editingMember.id, updateData);

    toast({
      title: 'Ejecutivo actualizado',
      description: `Los datos de ${data.name} han sido actualizados.`,
    });

    handleCloseDialogs();
  };

  const handleDeleteMember = () => {
    if (!deletingMember) return;

    deleteUser(deletingMember.id);

    toast({
      title: 'Ejecutivo eliminado',
      description: `${deletingMember.name} ha sido eliminado del equipo.`,
      variant: 'destructive',
    });

    setDeletingMember(null);
  };

  return (
    <Layout title="Mi Equipo">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mi Equipo</h1>
            <p className="text-muted-foreground">
              Gestiona y supervisa el rendimiento de tu equipo de ejecutivos
            </p>
          </div>
          <Button onClick={handleOpenAddDialog} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Agregar Ejecutivo
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Miembros</p>
                  <p className="text-2xl font-bold text-foreground">{teamStats.totalMembers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">XP Total</p>
                  <p className="text-2xl font-bold text-foreground">{teamStats.totalXP.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <Star className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">XP Promedio</p>
                  <p className="text-2xl font-bold text-foreground">{teamStats.avgXP.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Target className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ventas Totales</p>
                  <p className="text-2xl font-bold text-foreground">{teamStats.totalSales}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Ranking del Equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Sin miembros en el equipo
                </h3>
                <p className="text-muted-foreground mb-4">
                  Aún no tienes ejecutivos asignados a tu equipo.
                </p>
                <Button variant="outline" onClick={handleOpenAddDialog} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Agregar primer ejecutivo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedMembers.map((member, index) => {
                  const memberLevel = getLevelByXP(member.xp || 0);
                  const memberSales = getSalesByUser(String(member.id));
                  const progress = getProgressToNextLevel(member.xp || 0);

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                        index === 0 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-card'
                      }`}
                    >
                      {/* Rank */}
                      <div className="w-10 h-10 flex items-center justify-center">
                        {getRankBadge(index)}
                      </div>

                      {/* Avatar */}
                      <Avatar className="w-12 h-12 border-2 border-primary/20">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground truncate">
                            {member.name}
                          </h4>
                          {memberLevel && (
                            <Badge variant="secondary" className="text-xs">
                              {memberLevel.icon} {memberLevel.level}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-500" />
                            {(member.xp || 0).toLocaleString()} XP
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="w-4 h-4 text-purple-500" />
                            {memberSales.length} ventas
                          </span>
                          {(member.streak || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <Flame className="w-4 h-4 text-orange-500" />
                              {member.streak} días
                            </span>
                          )}
                          {(member.shields || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-4 h-4 text-blue-500" />
                              {member.shields}
                            </span>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2">
                          <Progress value={progress} className="h-2" />
                        </div>
                      </div>

                      {/* Country & Segment */}
                      <div className="hidden md:flex flex-col items-end gap-1">
                        {member.country && (
                          <Badge variant="outline" className="text-xs">
                            {member.country}
                          </Badge>
                        )}
                        {member.segment && (
                          <Badge variant="outline" className="text-xs">
                            {member.segment}
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(member)}
                          className="h-8 w-8"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingMember(member)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingMember} onOpenChange={(open) => !open && handleCloseDialogs()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? 'Editar Ejecutivo' : 'Agregar Ejecutivo'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(editingMember ? onSubmitEdit : onSubmitAdd)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" {...register('name')} placeholder="Nombre del ejecutivo" />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div className="col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} placeholder="email@empresa.com" />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>

              <div className="col-span-2">
                <Label htmlFor="password">
                  {editingMember ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'}
                </Label>
                <Input id="password" type="password" {...register('password')} placeholder="••••••" />
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <Label>País</Label>
                <Select value={watch('country')} onValueChange={(value) => setValue('country', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar país" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-sm text-destructive mt-1">{errors.country.message}</p>}
              </div>

              <div>
                <Label>Segmento</Label>
                <Select value={watch('segment')} onValueChange={(value) => setValue('segment', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((segment) => (
                      <SelectItem key={segment} value={segment}>
                        {segment}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.segment && <p className="text-sm text-destructive mt-1">{errors.segment.message}</p>}
              </div>

              <div className="col-span-2">
                <Label>Célula</Label>
                <Select value={watch('cellId')} onValueChange={(value) => setValue('cellId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar célula" />
                  </SelectTrigger>
                  <SelectContent>
                    {CELLS.map((cell) => (
                      <SelectItem key={cell} value={cell}>
                        {cell}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.cellId && <p className="text-sm text-destructive mt-1">{errors.cellId.message}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialogs}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingMember ? 'Guardar cambios' : 'Agregar ejecutivo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ejecutivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente a{' '}
              <strong>{deletingMember?.name}</strong> del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default MyTeam;