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
          <TabsList className="grid w-full grid-cols-5 mb-6 h-auto p-1 bg-muted/40 rounded-xl">
            <TabsTrigger 
              value="products" 
              className="flex items-center gap-2 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary"
            >
              <span className="text-sm">🎯</span>
              Productos
            </TabsTrigger>
            <TabsTrigger 
              value="levels"
              className="flex items-center gap-2 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary"
            >
              <span className="text-sm">⭐</span>
              Niveles
            </TabsTrigger>
            <TabsTrigger 
              value="medals"
              className="flex items-center gap-2 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary"
            >
              <span className="text-sm">🏅</span>
              Medallas
            </TabsTrigger>
            <TabsTrigger 
              value="streaks"
              className="flex items-center gap-2 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary"
            >
              <span className="text-sm">🔥</span>
              Rachas
            </TabsTrigger>
            <TabsTrigger 
              value="recognitions"
              className="flex items-center gap-2 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary"
            >
              <span className="text-sm">💌</span>
              Reconocimientos
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
