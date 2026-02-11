import { useState } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useCells } from '@/hooks/useCells';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserPlus, Users as UsersIcon, Mail, Globe, Target, Briefcase, Pencil, Trash2, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { AuthUser } from '@/hooks/useSupabaseAuth';

const userSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100, 'El nombre es muy largo'),
  nickname: z.string().max(30, 'El apodo es muy largo').optional(),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').or(z.literal('')).optional(),
  role: z.enum(['GERENTE', 'EJECUTIVO'], { required_error: 'Selecciona un rol' }),
  country: z.string().optional(),
  segment: z.enum(['Empresarios', 'Aliados', 'B&M', 'Despachos']).optional(),
  cellId: z.string().optional(),
  managerId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

const Users = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const { profiles, getManagers, createUserWithAuth, updateUserProfile, deleteUserProfile, fetchProfiles } = useProfiles();
  const { cells } = useCells();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AuthUser | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const selectedRole = watch('role');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />;
  }

  const users = profiles.filter(p => p.role !== 'ADMINISTRADOR');
  const managers = getManagers();

  const onSubmit = async (data: UserFormData) => {
    try {
      if (editingUser) {
        // Update existing user
        const { error } = await updateUserProfile(editingUser.id, {
          name: data.name,
          email: data.email,
          country: data.country || null,
          segment: data.segment || null,
          cell_id: data.cellId || null,
          manager_id: data.managerId || null,
        });

        if (error) throw error;

        toast({
          title: '✅ Usuario actualizado',
          description: `${data.name} ha sido actualizado exitosamente`,
        });
      } else {
        // Create new user
        const { error } = await createUserWithAuth({
          name: data.name,
          email: data.email,
          password: data.password!,
          role: data.role,
          avatar: data.role === 'GERENTE' ? '👨‍💼' : '👩‍💻',
          country: data.country,
          segment: data.segment,
          cell_id: data.cellId,
          manager_id: data.managerId,
        });

        if (error) throw error;

        toast({
          title: '✅ Usuario creado',
          description: `${data.name} ha sido agregado exitosamente`,
        });
      }

      reset();
      setOpen(false);
      setEditingUser(null);
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: error.message || (editingUser ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario'),
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (usr: AuthUser) => {
    setEditingUser(usr);
    setValue('name', usr.name);
    setValue('email', usr.email);
    setValue('role', usr.role as 'GERENTE' | 'EJECUTIVO');
    setValue('country', usr.country || '');
    setValue('segment', usr.segment as any);
    setValue('cellId', usr.cell_id || '');
    setValue('managerId', usr.manager_id || '');
    setOpen(true);
  };

  const handleDeleteClick = (usr: AuthUser) => {
    setUserToDelete(usr);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      try {
        const { error } = await deleteUserProfile(userToDelete.id);
        if (error) throw error;
        
        toast({
          title: '✅ Usuario eliminado',
          description: `${userToDelete.name} ha sido eliminado del sistema`,
        });
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      } catch (error: any) {
        toast({
          title: '❌ Error',
          description: error.message || 'No se pudo eliminar el usuario',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDialogClose = () => {
    setOpen(false);
    setEditingUser(null);
    reset();
  };

  const handleNewUser = () => {
    setEditingUser(null);
    reset();
    setOpen(true);
  };

  return (
    <Layout title="Gestión de Usuarios">
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-primary" />
              Usuarios del Sistema
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Gestiona los usuarios de la plataforma
            </p>
          </div>

          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={handleNewUser}>
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </Button>

          <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) {
              handleDialogClose();
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                {/* Nombre completo */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="Ej: Juan Pérez García"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                {/* Apodo/Nickname */}
                <div className="space-y-2">
                  <Label htmlFor="nickname" className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Apodo (opcional)
                  </Label>
                  <Input
                    id="nickname"
                    {...register('nickname')}
                    placeholder="Ej: Juancho"
                  />
                  {errors.nickname && (
                    <p className="text-sm text-destructive">{errors.nickname.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="usuario@empresa.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                {/* Contraseña */}
                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña *</Label>
                    <Input
                      id="password"
                      type="password"
                      {...register('password')}
                      placeholder="Mínimo 6 caracteres"
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Rol */}
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol *</Label>
                    <Select 
                      value={watch('role')} 
                      onValueChange={(value) => setValue('role', value as 'GERENTE' | 'EJECUTIVO')}
                      disabled={!!editingUser}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GERENTE">👨‍💼 Gerente</SelectItem>
                        <SelectItem value="EJECUTIVO">👩‍💻 Ejecutivo de Ventas</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && (
                      <p className="text-sm text-destructive">{errors.role.message}</p>
                    )}
                  </div>

                  {/* País */}
                  <div className="space-y-2">
                    <Label htmlFor="country" className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      País
                    </Label>
                    <Select 
                      value={watch('country')} 
                      onValueChange={(value) => setValue('country', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el país" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Colombia">🇨🇴 Colombia</SelectItem>
                        <SelectItem value="México">🇲🇽 México</SelectItem>
                        <SelectItem value="Ecuador">🇪🇨 Ecuador</SelectItem>
                        <SelectItem value="Perú">🇵🇪 Perú</SelectItem>
                        <SelectItem value="Chile">🇨🇱 Chile</SelectItem>
                        <SelectItem value="Uruguay">🇺🇾 Uruguay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Segmento */}
                  <div className="space-y-2">
                    <Label htmlFor="segment" className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Segmento
                    </Label>
                    <Select 
                      value={watch('segment')} 
                      onValueChange={(value) => setValue('segment', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Empresarios">Empresarios</SelectItem>
                        <SelectItem value="Aliados">Aliados</SelectItem>
                        <SelectItem value="B&M">B&M</SelectItem>
                        <SelectItem value="Despachos">Despachos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Célula */}
                  <div className="space-y-2">
                    <Label htmlFor="cellId" className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Célula
                    </Label>
                    <Select 
                      value={watch('cellId') || ''} 
                      onValueChange={(value) => setValue('cellId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la célula" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin asignar</SelectItem>
                        {cells.map(cell => (
                          <SelectItem key={cell.id} value={cell.id}>
                            {cell.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Gerente (solo para ejecutivos) */}
                {selectedRole === 'EJECUTIVO' && (
                  <div className="space-y-2">
                    <Label htmlFor="managerId">Gerente Inmediato</Label>
                    <Select 
                      value={watch('managerId')} 
                      onValueChange={(value) => setValue('managerId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el gerente" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground">{users.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Usuarios</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground">{users.filter(u => u.role === 'GERENTE').length}</p>
              <p className="text-[10px] text-muted-foreground">Gerentes</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground">{users.filter(u => u.role === 'EJECUTIVO').length}</p>
              <p className="text-[10px] text-muted-foreground">Ejecutivos</p>
            </div>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5">
            <h2 className="text-sm font-bold mb-4 text-foreground">Lista de Usuarios</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Célula</TableHead>
                    <TableHead>Gerente</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay usuarios registrados. Crea el primer usuario.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((usr) => {
                      const manager = managers.find(m => m.id === usr.manager_id);
                      return (
                        <TableRow key={usr.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{usr.avatar}</span>
                              <span className="font-medium">{usr.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{usr.email}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              usr.role === 'GERENTE' 
                                ? 'bg-primary/10 text-primary' 
                                : 'bg-secondary/10 text-secondary-foreground'
                            }`}>
                              {usr.role}
                            </span>
                          </TableCell>
                          <TableCell>{usr.country || '-'}</TableCell>
                          <TableCell>{usr.segment || '-'}</TableCell>
                          <TableCell>{usr.cell_id || '-'}</TableCell>
                          <TableCell>{manager?.name || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEdit(usr)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(usr)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El usuario {userToDelete?.name} será eliminado permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Users;