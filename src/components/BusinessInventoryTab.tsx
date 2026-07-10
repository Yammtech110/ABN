import React from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { Package, Plus } from 'lucide-react';

export const BusinessInventoryTab: React.FC = () => {
  const { language, currentUser, businesses, products } = useDirectory();
  const t = TRANSLATIONS[language];
  const isRTL = language === 'ar' || language === 'fa';

  const myBusiness = businesses.find((b) => b.ownerId === currentUser?.id);
  const myProducts = products.filter((p) => p.businessId === myBusiness?.id);

  if (!myBusiness) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-gray-400 text-center text-sm">No business profile found. Please register your business first.</p>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-black overflow-y-auto ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="pt-12 pb-6 px-6 relative shrink-0">
        <div className="absolute inset-0 bg-[#FFA048]/10 blur-3xl rounded-full translate-y-[-50%] z-0" />
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Inventory</h1>
            <p className="text-xs text-gray-400 mt-1">Manage your products and services</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-[#FFA048] flex items-center justify-center text-black shadow-lg shadow-[#FFA048]/20 hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-24 space-y-4 relative z-10">
        {myProducts.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-[#13110E] rounded-3xl border border-[#2D2319]">
            <div className="w-16 h-16 rounded-full bg-[#2D2319] flex items-center justify-center mb-4 text-[#FFA048]">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-white font-bold mb-1">No products yet</h3>
            <p className="text-xs text-gray-500 max-w-[200px]">Add your first product to start showing it to customers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {myProducts.map((prod) => (
              <div key={prod.id} className="bg-[#13110E] border border-[#2D2319] rounded-2xl overflow-hidden flex flex-col">
                <div className="aspect-square w-full relative">
                  <img src={prod.imageUrl} alt={prod.name[language as 'en'|'ar']} className="w-full h-full object-cover" />
                  {!prod.inStock && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">OUT OF STOCK</span>
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h4 className="text-white font-bold text-xs truncate mb-1">{prod.name[language as 'en'|'ar'] || prod.name.en}</h4>
                  <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed flex-1">
                    {prod.description[language as 'en'|'ar'] || prod.description.en}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[#FFA048] font-black text-sm">${prod.price.toFixed(2)}</span>
                    <button 
                      className={`px-2 py-1 rounded text-[9px] font-bold ${prod.inStock ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      onClick={() => {
                         // Mock toggle logic - would be in context normally
                         alert(`Toggled stock status for ${prod.name.en}`);
                      }}
                    >
                      {prod.inStock ? 'IN STOCK' : 'OUT OF STOCK'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
