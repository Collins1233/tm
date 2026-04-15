// Supabase client for TreatMaker
// Uses: https://jcvysdtholomauhiunsj.supabase.co

const SUPABASE_URL = 'https://jcvysdtholomauhiunsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdnlzZHRob2xvbWF1aGl1bnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDE2MDEsImV4cCI6MjA5MTgxNzYwMX0.S-oN-7SpiyEOMmgrVBSoUlVZfYhB2y3HZ6y2c3PH_Xs';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fallback localStorage key
const ORDERS_KEY = 'treatmaker_orders';

// ── MAIN API FUNCTIONS ──
async function getOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    // Merge with localStorage for offline data
    const local = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    const merged = [...(data || []), ...local];
    
    // Dedupe by ID, Supabase data takes priority
    const unique = {};
    merged.forEach(order => {
      if (!unique[order.id]) unique[order.id] = order;
    });
    
    return Object.values(unique);
  } catch (e) {
    console.warn('Supabase unavailable, using localStorage:', e);
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  }
}

async function saveOrder(order) {
  try {
    const { error } = await supabase
      .from('orders')
      .insert(order);
    
    if (error) throw error;
    
    // Also save locally for offline
    const orders = await getOrders();
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    
    return true;
  } catch (e) {
    console.warn('Supabase save failed:', e);
    // Fallback to localStorage
    const orders = await getOrders();
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return false;
  }
}

async function updateOrder(id, updates) {
  try {
    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
    
    // Update localStorage too
    const orders = await getOrders();
    const order = orders.find(o => o.id === id);
    if (order) {
      Object.assign(order, updates);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    }
    
    return true;
  } catch (e) {
    console.warn('Supabase update failed:', e);
    return false;
  }
}

async function deleteOrder(id) {
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // Update localStorage
    const orders = await getOrders();
    const newOrders = orders.filter(o => o.id !== id);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(newOrders));
    
    return true;
  } catch (e) {
    console.warn('Supabase delete failed:', e);
    return false;
  }
}

// ── REALTIME ──
let channel;
function subscribeToOrders(callback) {
  if (channel) channel.unsubscribe();
  
  channel = supabase.channel('orders')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => callback(payload)
    )
    .subscribe();
}

// ── EXPORT (global) ──
window.treatmakerSupabase = {
  getOrders, saveOrder, updateOrder, deleteOrder, subscribeToOrders
};

