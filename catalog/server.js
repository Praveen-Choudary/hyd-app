// Catalog microservice - 100 products generated from 10 categories x 10 items
const http = require('http');
const C = {
  'Groceries':[100,['Basmati Rice 5kg','🍚'],['Toor Dal 1kg','🫘'],['Sunflower Oil 1L','🛢️'],['Atta 5kg','🌾'],['Biryani Masala','🧂'],['Tea Powder 500g','🍵'],['Filter Coffee 250g','☕'],['Pure Ghee 500ml','🧈'],['Avakaya Pickle','🥭'],['Jaggery 1kg','🍯']],
  'Hyderabad Specials':[80,['Karachi Fruit Biscuits','🍪'],['Haleem Mix','🍲'],['Double ka Meetha Kit','🍮'],['Qubani ka Meetha','🍑'],['Irani Chai Pack','🫖'],['Osmania Biscuits','🍘'],['Dum Biryani Kit','🍛'],['Hyderabadi Pearls Set','📿'],['Charminar Souvenir','🕌'],['Bidriware Vase','🏺']],
  'Electronics':[1500,['Smartphone 5G','📱'],['Laptop 15"','💻'],['Wireless Earbuds','🎧'],['Smart Watch','⌚'],['Bluetooth Speaker','🔊'],['Power Bank 20000mAh','🔋'],['4K Smart TV 43"','📺'],['Tablet 10"','📟'],['Wi-Fi Router','📡'],['Webcam HD','📷']],
  'Fashion':[700,['Cotton Kurta','👘'],['Pochampally Ikat Saree','🥻'],['Denim Jeans','👖'],['Running Shoes','👟'],['Leather Wallet','👛'],['Sunglasses','🕶️'],['Silk Dupatta','🧣'],['Casual Shirt','👔'],['Sneakers White','👞'],['Laptop Backpack','🎒']],
  'Home':[600,['Cotton Bedsheet','🛏️'],['Table Lamp','💡'],['Wall Clock','🕰️'],['Curtains Pair','🪟'],['Door Mat','🚪'],['Storage Box Set','📦'],['Wall Mirror','🪞'],['Indoor Plant','🪴'],['Cushion Covers','🛋️'],['Bath Towel Set','🧺']],
  'Kitchen':[500,['Pressure Cooker 5L','🍳'],['Non-stick Tawa','🥘'],['Mixer Grinder','🌀'],['Steel Tiffin Box','🍱'],['Knife Set','🔪'],['Dinner Set 24pc','🍽️'],['Water Bottle 1L','🚰'],['Air Fryer','♨️'],['Idli Maker','⚪'],['Biryani Handi','🫕']],
  'Beauty':[350,['Sandalwood Soap','🧼'],['Herbal Shampoo','🧴'],['Face Cream','🧖'],['Kajal Pencil','👁️'],['Lip Balm','💄'],['Hair Oil 200ml','💧'],['Sunscreen SPF50','☀️'],['Perfume Attar','🌸'],['Face Wash','🫧'],['Mehendi Cones','🌿']],
  'Books':[250,['Hyderabad Chronicles','📖'],['Telugu Poetry','📚'],['Ponniyin Selvan','📕'],['Wings of Fire','🔥'],['Cookbook: Dum Pukht','📙'],['Kids Story Set','🧒'],['Sketch Diary','📓'],['Maths Olympiad Guide','➗'],['Yoga Handbook','🧘'],['Travel Journal','🧳']],
  'Sports':[800,['Cricket Bat','🏏'],['Cricket Ball Pack','⚾'],['Football','⚽'],['Badminton Racket','🏸'],['Yoga Mat','🟪'],['Dumbbell 10kg','🏋️'],['Skipping Rope','➰'],['Cycling Helmet','⛑️'],['Tennis Racket','🎾'],['Fitness Band','⌚']],
  'Toys':[300,['Building Blocks','🧱'],['Remote Car','🏎️'],['Teddy Bear','🧸'],['Ludo Board Game','🎲'],['Jigsaw 500pc','🧩'],['Art Colour Set','🎨'],['Toy Train','🚂'],['Doll House','🏠'],['Science Kit','🔬'],['Carrom Board','🎯']]
};
const products = []; let id = 1;
for (const [cat, [base, ...items]] of Object.entries(C))
  items.forEach(([name, icon], i) => {
    const price = Math.round((base + (i * 37 % 20) * base / 10) / 10) * 10 - 1;
    products.push({ id: id, name, icon, category: cat, price, mrp: Math.round(price * 1.25), rating: +(3.8 + (id * 7 % 12) / 10).toFixed(1), stock: 10 + id * 3 % 90 }); id++;
  });
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); res.setHeader('Content-Type', 'application/json');
  if (u.pathname === '/health') return res.end('{"ok":true}');
  if (u.pathname === '/categories') return res.end(JSON.stringify(Object.keys(C)));
  if (u.pathname === '/products') {
    const c = u.searchParams.get('category'), q = (u.searchParams.get('q') || '').toLowerCase();
    return res.end(JSON.stringify(products.filter(p => (!c || p.category === c) && p.name.toLowerCase().includes(q))));
  }
  res.statusCode = 404; res.end('{"error":"not found"}');
}).listen(3000, () => console.log('catalog up, products:', products.length));
