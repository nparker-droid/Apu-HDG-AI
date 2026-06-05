import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { Leaf, Droplet, Zap, Trophy, Star, Medal, Award } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const mockData = [
  { month: 'Ene', waterSaved: 4000, energySaved: 2400, carbonReduced: 2400 },
  { month: 'Feb', waterSaved: 3000, energySaved: 1398, carbonReduced: 2210 },
  { month: 'Mar', waterSaved: 2000, energySaved: 9800, carbonReduced: 2290 },
  { month: 'Abr', waterSaved: 2780, energySaved: 3908, carbonReduced: 2000 },
  { month: 'May', waterSaved: 1890, energySaved: 4800, carbonReduced: 2181 },
  { month: 'Jun', waterSaved: 2390, energySaved: 3800, carbonReduced: 2500 },
  { month: 'Jul', waterSaved: 3490, energySaved: 4300, carbonReduced: 2100 },
];

const StatCard = ({ title, value, unit, icon: Icon, color }: any) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-4 rounded-xl ${color}`}>
      <Icon className="w-8 h-8 text-white" />
    </div>
    <div>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <div className="flex items-baseline gap-1">
        <h3 className="text-2xl font-black text-[#004071]">{value}</h3>
        <span className="text-sm font-bold text-slate-500">{unit}</span>
      </div>
    </div>
  </div>
);

const AchievementCard = ({ achievement }: any) => {
  const Icon = achievement.icon === 'Star' ? Star : (achievement.icon === 'Droplet' ? Droplet : Leaf);
  const isUnlocked = !!achievement.unlockedAt;

  return (
    <div className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
      isUnlocked ? 'border-[#88C13E] bg-[#88C13E]/5' : 'border-slate-100 bg-slate-50 opacity-60'
    }`}>
      <div className={`p-3 rounded-full ${isUnlocked ? 'bg-[#88C13E] text-white' : 'bg-slate-200 text-slate-400'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className={`font-black uppercase tracking-wide text-sm ${isUnlocked ? 'text-[#004071]' : 'text-slate-400'}`}>
          {achievement.title}
        </h4>
        <p className="text-xs text-slate-500">{achievement.description}</p>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { profile } = useAppStore();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Profilr & Gamification Header */}
      <div className="flex justify-between items-end bg-gradient-to-r from-[#004071] to-[#002D50] rounded-3xl p-8 shadow-xl text-white">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-white/20 flex flex-col items-center justify-center border-4 border-white/30 backdrop-blur-sm">
            <span className="text-xs font-black uppercase tracking-widest text-[#D9E021]">Nivel</span>
            <span className="text-3xl font-black">{profile.level}</span>
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">{profile.name}</h1>
            <p className="text-[#88C13E] font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4" /> {profile.points} Puntos de Impacto
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
            <Medal className="w-5 h-5 text-[#D9E021]" />
            <span className="text-sm font-bold uppercase tracking-wider">{profile.achievements.length} Logros Desbloqueados</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Agua Ahorrada" value="19.5" unit="m³" icon={Droplet} color="bg-blue-500" />
        <StatCard title="Energía Ahorrada" value="2,400" unit="kWh" icon={Zap} color="bg-yellow-500" />
        <StatCard title="Reducción de Huella" value="850" unit="kg CO₂" icon={Leaf} color="bg-[#88C13E]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Resource Consumption Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-[#004071] uppercase tracking-widest">Tendencias de Impacto Ambiental</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCarbon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#88C13E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#88C13E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}/>
                <Area type="monotone" dataKey="waterSaved" name="Agua Ahorrada" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWater)" />
                <Area type="monotone" dataKey="carbonReduced" name="CO2 Reducido" stroke="#88C13E" strokeWidth={3} fillOpacity={1} fill="url(#colorCarbon)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gamification Achievements Grid */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-[#004071] uppercase tracking-widest flex items-center gap-2">
              <Award className="w-5 h-5 text-[#D9E021]" /> Medallas y Logros
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold uppercase">
              {profile.achievements.length} / 3 Desbloqueados
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 flex-1">
            <AchievementCard 
              achievement={{ id: 'first_project', title: 'Pionero', description: 'Creaste tu primer proyecto', icon: 'Star', unlockedAt: profile.achievements.find(a => a.id === 'first_project')?.unlockedAt }} 
            />
            <AchievementCard 
              achievement={{ id: 'save_water', title: 'Guardián del Agua', description: 'Registraste ahorro hídrico significativo', icon: 'Droplet', unlockedAt: profile.achievements.find(a => a.id === 'save_water')?.unlockedAt }} 
            />
            <AchievementCard 
              achievement={{ id: 'eco_expert', title: 'Eco Experto', description: 'Alcanzaste 500 puntos de impacto', icon: 'Leaf', unlockedAt: profile.achievements.find(a => a.id === 'eco_expert')?.unlockedAt }} 
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
