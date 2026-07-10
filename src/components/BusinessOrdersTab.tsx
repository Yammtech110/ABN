import React, { useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import { PackageOpen, Clock, CheckCircle, Truck, XCircle, Search } from 'lucide-react';

export const BusinessOrdersTab: React.FC = () => {
  const { language, currentUser, businesses, orders, products } = useDirectory();
  const t = TRANSLATIONS[language];
  const isRTL = language === 'ar' || language === 'fa';

  const myBusiness = businesses.find((b) => b.ownerId === currentUser?.id);
  const myOrders = orders.filter((o) => o.businessId === myBusiness?.id);
  const [filterTab, setFilterTab] = useState<'pending' | 'processing' | 'completed'>('pending');

  const filteredOrders = myOrders.filter(o => {
    if (filterTab === 'pending') return o.status === 'pending';
    if (filterTab === 'processing') return o.status === 'processing' || o.status === 'shipped';
    if (filterTab === 'completed') return o.status === 'delivered' || o.status === 'cancelled';
    return true;
  });

  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    processing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    shipped: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    delivered: 'bg-green-500/10 text-green-500 border-green-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
  };

  const getProduct = (id: string) => products.find(p => p.id === id);

  if (!myBusiness) return null;

  return (
    <div className={`h-full flex flex-col bg-black overflow-y-auto ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="pt-12 pb-6 px-6 relative shrink-0">
        <div className="absolute inset-0 bg-[#FFA048]/10 blur-3xl rounded-full translate-y-[-50%] z-0" />
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-white tracking-tight">Orders</h1>
          <p className="text-xs text-gray-400 mt-1">Track and manage customer orders</p>
        </div>
      </div>

      <div className="px-6 mb-4 relative z-10 space-y-3">
        <div className="flex items-center bg-[#13110E] border border-[#2D2319] rounded-xl px-4 py-3">
          <Search className="w-4 h-4 text-gray-500 mr-3" />
          <input 
            type="text" 
            placeholder="Search orders..." 
            className="bg-transparent border-none text-white text-sm outline-none w-full placeholder:text-gray-600"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setFilterTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${filterTab === 'pending' ? 'bg-[#FFA048] text-black' : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'}`}
          >
            Pending
          </button>
          <button 
            onClick={() => setFilterTab('processing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${filterTab === 'processing' ? 'bg-[#FFA048] text-black' : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'}`}
          >
            Active
          </button>
          <button 
            onClick={() => setFilterTab('completed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${filterTab === 'completed' ? 'bg-[#FFA048] text-black' : 'bg-[#13110E] text-gray-400 border border-[#2D2319]'}`}
          >
            Completed
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-24 space-y-4 relative z-10">
        {filteredOrders.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-[#13110E] rounded-3xl border border-[#2D2319]">
            <div className="w-16 h-16 rounded-full bg-[#2D2319] flex items-center justify-center mb-4 text-[#FFA048]">
              <PackageOpen className="w-8 h-8" />
            </div>
            <h3 className="text-white font-bold mb-1">No orders yet</h3>
            <p className="text-xs text-gray-500 max-w-[200px]">When customers place orders, they will appear here.</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-[#13110E] border border-[#2D2319] rounded-2xl p-4 flex flex-col">
              <div className="flex justify-between items-start mb-3 pb-3 border-b border-[#2D2319]">
                <div>
                  <h4 className="text-white font-bold text-sm">Order #{order.id.split('-')[1]}</h4>
                  <p className="text-[10px] text-gray-400">{order.date}</p>
                </div>
                <span className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${statusColors[order.status]}`}>
                  {order.status}
                </span>
              </div>
              
              <div className="space-y-3 mb-4">
                {order.items.map((item, idx) => {
                  const prod = getProduct(item.productId);
                  return (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-mono">{item.quantity}x</span>
                        <span className="text-gray-200">{prod ? (prod.name[language as 'en'|'ar'] || prod.name.en) : 'Unknown Product'}</span>
                      </div>
                      <span className="text-gray-400">${(item.priceAtPurchase * item.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[#2D2319] mb-4">
                <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Total</span>
                <span className="text-[#FFA048] font-black">${order.totalAmount.toFixed(2)}</span>
              </div>

              <div className="bg-[#1C1914] rounded-xl p-3 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-white">{order.customerName}</p>
                    <p className="text-[10px] text-gray-400">{order.customerPhone}</p>
                  </div>
                  {order.status === 'pending' && (
                    <button className="text-[10px] font-bold bg-[#FFA048] text-black px-4 py-1.5 rounded-lg hover:bg-[#ffb470] transition-colors shadow-lg shadow-[#FFA048]/20">
                      Accept Order
                    </button>
                  )}
                  {order.status === 'processing' && (
                    <button className="text-[10px] font-bold bg-green-500 text-white px-4 py-1.5 rounded-lg hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20">
                      Mark as Completed
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
