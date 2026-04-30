import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Flame, Award, Gift, Package } from 'lucide-react';
import Layout from '@/components/layout/Layout';

import GamificationRetosTab from '@/components/admin/gamification/GamificationRetosTab';
import GamificationRachasTab from '@/components/admin/gamification/GamificationRachasTab';
import GamificationMedallasTab from '@/components/admin/gamification/GamificationMedallasTab';
import GamificationPremiosTab from '@/components/admin/gamification/GamificationPremiosTab';
import GamificationCanjesTab from '@/components/admin/gamification/GamificationCanjesTab';

export default function AdminGamification() {
  const [tab, setTab] = useState('retos');

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gamificación · Venta Cruzada</h1>
          <p className="text-muted-foreground">
            Configura retos, rachas, medallas, premios y gestiona canjes de los asesores VC.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="retos" className="gap-2"><Trophy className="h-4 w-4" /> Retos</TabsTrigger>
            <TabsTrigger value="rachas" className="gap-2"><Flame className="h-4 w-4" /> Rachas</TabsTrigger>
            <TabsTrigger value="medallas" className="gap-2"><Award className="h-4 w-4" /> Medallas</TabsTrigger>
            <TabsTrigger value="premios" className="gap-2"><Gift className="h-4 w-4" /> Premios</TabsTrigger>
            <TabsTrigger value="canjes" className="gap-2"><Package className="h-4 w-4" /> Canjes</TabsTrigger>
          </TabsList>

          <TabsContent value="retos" className="mt-6"><GamificationRetosTab /></TabsContent>
          <TabsContent value="rachas" className="mt-6"><GamificationRachasTab /></TabsContent>
          <TabsContent value="medallas" className="mt-6"><GamificationMedallasTab /></TabsContent>
          <TabsContent value="premios" className="mt-6"><GamificationPremiosTab /></TabsContent>
          <TabsContent value="canjes" className="mt-6"><GamificationCanjesTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
