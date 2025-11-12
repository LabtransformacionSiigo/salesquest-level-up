import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Layout from '@/components/layout/Layout';
import ProductsTab from '@/components/settings/ProductsTab';
import LevelsTab from '@/components/settings/LevelsTab';
import MedalsTab from '@/components/settings/MedalsTab';
import StreaksTab from '@/components/settings/StreaksTab';
import RecognitionsTab from '@/components/settings/RecognitionsTab';

const Settings = () => {
  return (
    <Layout title="Configuración">
      <div className="animate-fade-in">
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8 h-auto p-2 bg-muted/50">
            <TabsTrigger 
              value="products" 
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
            >
              <span className="text-xl">🎯</span>
              <span className="text-xs font-semibold">Productos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="levels"
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-gradient-secondary data-[state=active]:text-secondary-foreground"
            >
              <span className="text-xl">⭐</span>
              <span className="text-xs font-semibold">Niveles</span>
            </TabsTrigger>
            <TabsTrigger 
              value="medals"
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-gradient-accent data-[state=active]:text-accent-foreground"
            >
              <span className="text-xl">🏅</span>
              <span className="text-xs font-semibold">Medallas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="streaks"
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
            >
              <span className="text-xl">🔥</span>
              <span className="text-xs font-semibold">Rachas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="recognitions"
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-gradient-secondary data-[state=active]:text-secondary-foreground"
            >
              <span className="text-xl">💌</span>
              <span className="text-xs font-semibold">Reconocimientos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductsTab />
          </TabsContent>

          <TabsContent value="levels">
            <LevelsTab />
          </TabsContent>

          <TabsContent value="medals">
            <MedalsTab />
          </TabsContent>

          <TabsContent value="streaks">
            <StreaksTab />
          </TabsContent>

          <TabsContent value="recognitions">
            <RecognitionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
