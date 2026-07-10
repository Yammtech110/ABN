import React, { useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { TrendingUp, DollarSign, Activity } from 'lucide-react';

export const BusinessProfitLossTab: React.FC = () => {
  const { language, currentUser, businesses } = useDirectory();
  const t = TRANSLATIONS[language];
  const isRTL = language === 'ar' || language === 'fa';
  
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');

  const myBusiness = businesses.find((b) => b.ownerId === currentUser?.id);

  if (!myBusiness) return null;

  // Mock data for the chart since real data calculation would require full history
  const monthlyData = [120, 200, 150, 300, 280, 420, 380, 500, 460, 550, 600, 750];
  const yearlyData = [2500, 3200, 2800, 4100, 5000];

  const currentData = viewMode === 'monthly' ? monthlyData : yearlyData;
  const labels = viewMode === 'monthly' 
    ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
    : ['2022', '2023', '2024', '2025', '2026'];

  const maxData = Math.max(...currentData);
  const minData = Math.min(...currentData);
  
  const totalRevenue = currentData.reduce((a, b) => a + b, 0);
  const netProfit = totalRevenue * 0.65; // Mock 65% profit margin

  // Generate SVG path for a smooth line chart
  const createPath = (data: number[], width: number, height: number) => {
    if (data.length === 0) return { path: '', points: [] };
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - minData * 0.8) / (maxData - minData * 0.8)) * height;
      return { x, y };
    });

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cp1x = p1.x + (p2.x - p1.x) / 2;
      const cp1y = p1.y;
      const cp2x = p1.x + (p2.x - p1.x) / 2;
      const cp2y = p2.y;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return { path, points };
  };

  const svgWidth = 300;
  const svgHeight = 150;
  const { path: linePath, points: chartPoints } = createPath(currentData, svgWidth, svgHeight);

  // For the area fill under the curve
  const areaPath = `${linePath} L ${svgWidth},${svgHeight} L 0,${svgHeight} Z`;

  return (
    <div className={`h-full flex flex-col bg-black overflow-y-auto ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="pt-12 pb-6 px-6 relative shrink-0">
        <div className="absolute inset-0 bg-[#FFA048]/10 blur-3xl rounded-full translate-y-[-50%] z-0" />
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1>
            <p className="text-xs text-gray-400 mt-1">Profit & Loss Performance</p>
          </div>
          <div className="bg-[#13110E] border border-[#2D2319] rounded-xl p-1 flex">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${viewMode === 'monthly' ? 'bg-[#FFA048] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              12M
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${viewMode === 'yearly' ? 'bg-[#FFA048] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              5Y
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 flex-1 pb-24 space-y-4 relative z-10">
        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#13110E] border border-[#2D2319] rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Activity className="w-12 h-12 text-[#FFA048]" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 relative z-10">Total Revenue</p>
            <h3 className="text-xl font-black text-white relative z-10">${totalRevenue.toLocaleString()}</h3>
            <div className="mt-2 text-[10px] text-green-400 font-bold flex items-center relative z-10">
              <TrendingUp className="w-3 h-3 mr-1" /> +12.5% vs last
            </div>
          </div>
          
          <div className="bg-[#13110E] border border-[#2D2319] rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <DollarSign className="w-12 h-12 text-[#FFA048]" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 relative z-10">Net Profit</p>
            <h3 className="text-xl font-black text-[#FFA048] relative z-10">${netProfit.toLocaleString()}</h3>
            <div className="mt-2 text-[10px] text-green-400 font-bold flex items-center relative z-10">
              <TrendingUp className="w-3 h-3 mr-1" /> +8.2% margin
            </div>
          </div>
        </div>

        {/* SVG Chart Layout */}
        <div className="bg-[#13110E] border border-[#2D2319] rounded-3xl p-5 mb-4">
          <h4 className="text-xs font-bold text-white mb-6 uppercase tracking-widest">Revenue Growth</h4>
          
          <div className="relative w-full h-[150px]">
            <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="overflow-visible">
              <defs>
                <linearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFA048" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#FFA048" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffb470" />
                  <stop offset="100%" stopColor="#FFA048" />
                </linearGradient>
              </defs>
              
              {/* Grid Lines */}
              <line x1="0" y1={svgHeight} x2={svgWidth} y2={svgHeight} stroke="#2D2319" strokeWidth="1" />
              <line x1="0" y1={svgHeight/2} x2={svgWidth} y2={svgHeight/2} stroke="#2D2319" strokeWidth="1" strokeDasharray="4" />
              <line x1="0" y1="0" x2={svgWidth} y2="0" stroke="#2D2319" strokeWidth="1" strokeDasharray="4" />

              {/* Area Fill */}
              <path d={areaPath} fill="url(#gradientFill)" />
              
              {/* Smooth Line */}
              <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg" />
              
              {/* Data Points */}
              {chartPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#13110E" stroke="#FFA048" strokeWidth="2" className="hover:r-5 transition-all cursor-pointer" />
              ))}
            </svg>
          </div>
          
          {/* X Axis Labels */}
          <div className="flex justify-between mt-4">
            {labels.map((label, i) => (
              <span key={i} className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
