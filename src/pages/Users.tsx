import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserPlus, Users as UsersIcon, Mail, Calendar, Globe, Target, Briefcase, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';

const userSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100, 'El nombre es muy largo'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  role: z.enum(['GERENTE', 'EJECUTIVO'], { required_error: 'Selecciona un rol' }),
  joinDate: z.string().min(1, 'Selecciona la fecha de vinculación'),
  country: z.string().min(1, 'Selecciona el país'),
  segment: z.string().min(1, 'Ingresa el segmento'),
  cellId: z.string().min(1, 'Ingresa la célula'),
  managerId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

const Users = () => {
  const { isAuthenticated, user, addUser, updateUser, deleteUser, getAllUsers, getManagers } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
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

  if (user?.role !== 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />;
  }

  const users = getAllUsers();
  const managers = getManagers();

  const onSubmit = (data: UserFormData) => {
    try {
      if (editingUser) {
        // Update existing user
        updateUser(editingUser.id, {
          name: data.name,
          email: data.email,
          ...(data.password && { password: data.password }),
          role: data.role,
          joinDate: data.joinDate,
          country: data.country,
          segment: data.segment,
          cellId: data.cellId,
          managerId: data.managerId ? parseInt(data.managerId) : null,
          managerName: data.managerId
            ? managers.find(m => m.id === parseInt(data.managerId))?.name || null
            : null,
          avatar: data.role === 'GERENTE' ? '👨‍💼' : '👩‍💻',
        });

        toast({
          title: '✅ Usuario actualizado',
          description: `${data.name} ha sido actualizado exitosamente`,
        });
      } else {
        // Create new user
        const newUser = addUser({
          name: data.name,
          email: data.email,
          password: data.password!,
          role: data.role,
          joinDate: data.joinDate,
          country: data.country,
          segment: data.segment,
          cellId: data.cellId,
          managerId: data.managerId ? parseInt(data.managerId) : null,
          managerName: data.managerId
            ? managers.find(m => m.id === parseInt(data.managerId))?.name || null
            : null,
          avatar: data.role === 'GERENTE' ? '👨‍💼' : '👩‍💻',
        });

        toast({
          title: '✅ Usuario creado',
          description: `${newUser.name} ha sido agregado exitosamente`,
        });
      }

      reset();
      setOpen(false);
      setEditingUser(null);
    } catch (error) {
      toast({
        title: '❌ Error',
        description: editingUser ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (usr: User) => {
    setEditingUser(usr);
    setValue('name', usr.name);
    setValue('email', usr.email);
    setValue('role', usr.role as 'GERENTE' | 'EJECUTIVO');
    setValue('joinDate', usr.joinDate || '');
    setValue('country', usr.country || '');
    setValue('segment', usr.segment || '');
    setValue('cellId', usr.cellId || '');
    setValue('managerId', usr.managerId?.toString() || '');
    setOpen(true);
  };

  const handleDeleteClick = (usr: User) => {
    setUserToDelete(usr);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      try {
        deleteUser(userToDelete.id);
        toast({
          title: '✅ Usuario eliminado',
          description: `${userToDelete.name} ha sido eliminado del sistema`,
        });
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      } catch (error) {
        toast({
          title: '❌ Error',
          description: 'No se pudo eliminar el usuario',
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

  return (
    <Layout title="Gestión de Usuarios">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <UsersIcon className="w-8 h-8 text-primary" />
              Usuarios del Sistema
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestiona los usuarios de la plataforma SalesQuest
            </p>
          </div>

          <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <UserPlus className="w-5 h-5" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
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
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Contraseña {editingUser ? '(opcional - dejar vacío para mantener actual)' : '*'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    {...register('password')}
                    placeholder={editingUser ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Rol */}
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol *</Label>
                    <Select onValueChange={(value) => setValue('role', value as 'GERENTE' | 'EJECUTIVO')}>
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

                  {/* Fecha de vinculación */}
                  <div className="space-y-2">
                    <Label htmlFor="joinDate" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Fecha de Vinculación *
                    </Label>
                    <Input
                      id="joinDate"
                      type="date"
                      {...register('joinDate')}
                    />
                    {errors.joinDate && (
                      <p className="text-sm text-destructive">{errors.joinDate.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* País */}
                  <div className="space-y-2">
                    <Label htmlFor="country" className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      País *
                    </Label>
                    <Select onValueChange={(value) => setValue('country', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el país" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Colombia">🇨🇴 Colombia</SelectItem>
                        <SelectItem value="México">🇲🇽 México</SelectItem>
                        <SelectItem value="Argentina">🇦🇷 Argentina</SelectItem>
                        <SelectItem value="Chile">🇨🇱 Chile</SelectItem>
                        <SelectItem value="Perú">🇵🇪 Perú</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.country && (
                      <p className="text-sm text-destructive">{errors.country.message}</p>
                    )}
                  </div>

                  {/* Segmento */}
                  <div className="space-y-2">
                    <Label htmlFor="segment" className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Segmento *
                    </Label>
                    <Select onValueChange={(value) => setValue('segment', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Corporativo">Corporativo</SelectItem>
                        <SelectItem value="Empresarial">Empresarial</SelectItem>
                        <SelectItem value="PYME">PYME</SelectItem>
                        <SelectItem value="Retail">Retail</SelectItem>
                        <SelectItem value="Gobierno">Gobierno</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.segment && (
                      <p className="text-sm text-destructive">{errors.segment.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Célula */}
                  <div className="space-y-2">
                    <Label htmlFor="cellId" className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Célula *
                    </Label>
                    <Input
                      id="cellId"
                      {...register('cellId')}
                      placeholder="Ej: CEL-001"
                    />
                    {errors.cellId && (
                      <p className="text-sm text-destructive">{errors.cellId.message}</p>
                    )}
                  </div>

                  {/* Gerente (solo para ejecutivos) */}
                  {selectedRole === 'EJECUTIVO' && (
                    <div className="space-y-2">
                      <Label htmlFor="managerId">Gerente Inmediato *</Label>
                      <Select onValueChange={(value) => setValue('managerId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el gerente" />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id.toString()}>
                              {manager.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.managerId && (
                        <p className="text-sm text-destructive">{errors.managerId.message}</p>
                      )}
                    </div>
                  )}
                </div>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Usuarios</p>
                <p className="text-3xl font-bold text-foreground">{users.length}</p>
              </div>
              <UsersIcon className="w-12 h-12 text-primary opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gerentes</p>
                <p className="text-3xl font-bold text-foreground">
                  {users.filter(u => u.role === 'GERENTE').length}
                </p>
              </div>
              <div className="text-5xl">👨‍💼</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ejecutivos</p>
                <p className="text-3xl font-bold text-foreground">
                  {users.filter(u => u.role === 'EJECUTIVO').length}
                </p>
              </div>
              <div className="text-5xl">👩‍💻</div>
            </div>
          </Card>
        </div>

        {/* Tabla de usuarios */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Lista de Usuarios</h2>
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
                    <TableHead>Fecha Vinculación</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((usr) => (
                    <TableRow key={usr.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{usr.avatar}</span>
                          <span className="font-medium">{usr.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{usr.email}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          usr.role === 'ADMINISTRADOR' 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : usr.role === 'GERENTE'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {usr.role}
                        </span>
                      </TableCell>
                      <TableCell>{usr.country || '-'}</TableCell>
                      <TableCell>{usr.segment || '-'}</TableCell>
                      <TableCell>{usr.cellId || '-'}</TableCell>
                      <TableCell>{usr.managerName || '-'}</TableCell>
                      <TableCell>{usr.joinDate || '-'}</TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{usr.level || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {usr.role !== 'ADMINISTRADOR' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(usr)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteClick(usr)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el usuario{' '}
                <span className="font-semibold">{userToDelete?.name}</span> y todos sus datos asociados.
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
      </div>
    </Layout>
  );
};

export default Users;
