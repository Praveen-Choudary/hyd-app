// Orders microservice - Hyderabad pickup stores + order placement
const http = require('http');
const stores = [
  { id: 1, name: 'Banjara Hills Store', area: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad 500034', lat: 17.4156, lng: 78.4347 },
  { id: 2, name: 'Jubilee Hills Store', area: 'Jubilee Hills', address: 'Road No. 36, Jubilee Hills, Hyderabad 500033', lat: 17.4326, lng: 78.4071 },
  { id: 3, name: 'HITEC City Store', area: 'HITEC City', address: 'Mindspace Rd, Madhapur, Hyderabad 500081', lat: 17.4435, lng: 78.3772 },
  { id: 4, name: 'Gachibowli Store', area: 'Gachibowli', address: 'DLF Rd, Gachibowli, Hyderabad 500032', lat: 17.4401, lng: 78.3489 },
  { id: 5, name: 'Secunderabad Store', area: 'Secunderabad', address: 'SP Road, Secunderabad 500003', lat: 17.4399, lng: 78.4983 },
  { id: 6, name: 'Charminar Store', area: 'Old City', address: 'Near Charminar, Hyderabad 500002', lat: 17.3616, lng: 78.4747 },
  { id: 7, name: 'Kukatpally Store', area: 'Kukatpally', address: 'KPHB Colony, Hyderabad 500072', lat: 17.4948, lng: 78.3996 },
  { id: 8, name: 'Begumpet Store', area: 'Begumpet', address: 'Begumpet Main Rd, Hyderabad 500016', lat: 17.4435, lng: 78.4676 }
];
const orders = [];
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health') return res.end('{"ok":true}');
  if (req.url === '/stores') return res.end(JSON.stringify(stores));
  if (req.url === '/orders' && req.method === 'GET') return res.end(JSON.stringify(orders));
  if (req.url === '/orders' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      try {
        const o = JSON.parse(b);
        if (!o.name || !o.name.trim()) throw new Error('Enter your name to place the order.');
        if (!o.items || !o.items.length) throw new Error('Your cart is empty.');
        const order = { id: 'HYD' + (1000 + orders.length + 1), ...o, total: o.items.reduce((s, i) => s + i.price * i.qty, 0), status: 'Confirmed', at: new Date().toISOString() };
        orders.push(order); res.statusCode = 201; res.end(JSON.stringify(order));
      } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }
  res.statusCode = 404; res.end('{"error":"not found"}');
}).listen(3000, () => console.log('orders up'));
